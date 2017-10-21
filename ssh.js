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
            this.connection.on('error', (err) => {
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
                }).stderr.on('data', data => {
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
                        .on('close', (code, signal) => {
                            resolve(sshMessages);
                        })
                        .on('data', data => {
                            sshMessages += data;
                        });
                });
        });
    }

    async init() {
        await this.connect();
        // todo: selectMode - default shell, get, pull
        this.shell();
    }
}

const ssh = new SSHtool(config);

ssh.init().then().catch();