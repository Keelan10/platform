#!/usr/bin/env node

import '@ulixee/commons/lib/SourceMapSupport';
import cli from '../index';

cli().parseAsync().catch(console.error)
