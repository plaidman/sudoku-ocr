import { ChildProcess, spawn } from 'child_process';
import { stdout } from 'process';

function promisifyProcess(child: ChildProcess): Promise<ChildProcess> {
    return new Promise<ChildProcess>((resolve, reject) => {
        child.on('error', () => { reject(child); });
        child.on('exit', (code, signal) => {
            if (code !== 0) {
                reject(child);
                return;
            }

            resolve(child);
        });
    });
}

export async function runCommand(command: string, options: string[]): Promise<void> {
    stdout.write(`> ${command} ${options.join(' ')}\n`);

    const childProcess = spawn(command, options, {
        stdio: 'inherit',
    });

    await promisifyProcess(childProcess);

    stdout.write('\n');
}