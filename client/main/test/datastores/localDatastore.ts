import Datastore, { Runner, Table } from '@ulixee/datastore';
import { boolean, string } from '@ulixee/schema';

export default new Datastore({
  runners: {
    test: new Runner({
      run(ctx) {
        ctx.Output.emit({
          testerEcho: ctx.input.shouldTest,
          lastName: 'Clark',
          greeting: 'Hello world',
        });
      },
      schema: {
        input: {
          shouldTest: boolean(),
        },
        output: {
          testerEcho: boolean(),
          lastName: string(),
          greeting: string(),
        },
      },
    }),
  },
  tables: {
    testers: new Table({
      schema: {
        firstName: string(),
        lastName: string(),
        isTester: boolean({ optional: true }),
      },
      seedlings: [
        { firstName: 'Caleb', lastName: 'Clark', isTester: true },
        { firstName: 'Blake', lastName: 'Byrnes' },
      ],
    }),
  },
});
