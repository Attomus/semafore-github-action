import * as core from '@actions/core';

export interface Logger {
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  setSecret(value: string): void;
  setOutput(name: string, value: string): void;
}

export const actionLogger: Logger = {
  info: core.info,
  warning: core.warning,
  error: core.error,
  setSecret: core.setSecret,
  setOutput: core.setOutput
};
