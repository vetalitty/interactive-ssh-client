const Client = require('ssh2').Client;
const config = require('./config.json');

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
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin
            .on('data', (key) => {
                if (key === ctrl_Q) process.exit();
                if (this.keyCodeStream) this.keyCodeStream.write('' + key);
            });
    }
}

const ssh = new SSHtool(config);

ssh.init().then().catch();