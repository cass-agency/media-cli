#!/usr/bin/env node

import { Command } from 'commander';
import { imageCommand } from './commands/image';
import { videoCommand } from './commands/video';

const program = new Command();

program
  .name('media-cli')
  .description('All-in-one CLI tool for image and video manipulation')
  .version('1.0.0');

program.addCommand(imageCommand);
program.addCommand(videoCommand);

program.parse(process.argv);
