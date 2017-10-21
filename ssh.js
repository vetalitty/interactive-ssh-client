const Client = require('ssh2').Client;
const config = require('./config.json');
const fs = require('fs');
let buf = '';

class SSHtool {
    constructor(config) {
        this.config = config;
        this.connection = new Client();
        this.keyCodeStream = null;
    }

    connect() {
        this.connection.connect(this.config);

        return new Promise((resolve, reject) => {
            this.connection.on('ready', () => {
                resolve();
            });
            this.connection.on('error', () => {
                reject('error connect');
            });
        });
    }

    shell() {
        let self = this;

        self.connection
            .shell((err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    self.connection.end();
                    process.exit(1);
                }).on('data', data => {
                    if (!this.keyCodeStream) this.keyCodeStream = stream;
                    if (this.keyCodeStream._writableState.sync === false) {
                        process.stdout.write('' + data);
                    }
                }).stderr.on('data', () => {
                    process.exit();
                });
            });
    }

    shellPutCommand(command) {
        let self = this;
        return new Promise((resolve, reject) => {
            self.connection
                .shell((err, stream) => {
                    if (err) reject(err);
                    stream.write(command);
                    stream.on('close', (data) => {
                    }).on('data', data => {
                        resolve(data);
                    }).stderr.on('data', (err) => {
                        reject(err);
                        process.exit();
                    });
                });
        });
    }

    execCommand(commandStr) {
        let self = this;
        return new Promise((resolve, reject) => {
            self.connection
                .exec(commandStr, (err, stream) => {
                    if (err) {
                        reject(err);
                    }
                    let sshMessages = '';
                    stream
                        .on('close', () => {
                            resolve(sshMessages);
                        })
                        .on('data', data => {
                            sshMessages += data;
                        });
                });
        });
    }

    getFile(from, localPath) {
        return new Promise((resolve, reject) => {
            this.connection.sftp((err, sftp) => {
                if (err) return reject(err);

                sftp.fastGet(from, localPath, {}, err => {
                    if (err) return reject(err);
                    resolve('Successfully downloaded');
                });
            });
        });
    }

    putFile(localPath, remotePath) {
        return new Promise((resolve, reject) => {
            this.connection.sftp((err, sftp) => {
                if (err) return reject(err);

                let readStream = fs.createReadStream(localPath);
                let writeStream = sftp.createWriteStream(remotePath);

                writeStream.on('end', () => {
                    return resolve('Successfully uploaded');
                });

                readStream.pipe(writeStream);
            });
        });
    }

    async init() {
        this._displayStartText();
        this._overrideButtons();
        await this.connect();
        this.shell();
    }

    _displayStartText() {
        process.stdout.write('Node JS SSH tool has been started\n');
        process.stdout.write('---------------------------------\n');
    }

    _overrideButtons() {
        const ctrl_Q = '\u0011';
        const ctrl_C = '\u0003';
        const enter = '\u000d';
        const tab = '\u0009';
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin
            .on('data', (key) => {
                process.stdout.write(key);
                buf += key;
                if (this.keyCodeStream && key === enter) {
                    if (buf.search(/^(get\s)+/i) !== -1) {
                        const filename = buf.substring(4, buf.length);
                        this.shellPutCommand('echo $(pwd)\n').then(res => console.log('pwd:', res.toString())).catch(err => console.log(err));
                        // ???
                        buf = '';
                    } else {
                        this.keyCodeStream.write(buf + '\n');
                        buf = '';
                    }
                }
                if (key === ctrl_Q) process.exit();
                if (key === ctrl_C && this.keyCodeStream) this.keyCodeStream.write('' + key);
                if (key === tab && this.keyCodeStream) this.keyCodeStream.write('' + key);
            });
    }
}

const ssh = new SSHtool(config);

ssh.init().then(res => {

}).catch(err => {
    console.log(err);
});