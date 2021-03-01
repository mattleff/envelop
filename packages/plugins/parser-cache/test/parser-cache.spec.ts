import { buildSchema, parse } from 'graphql';
import { createTestkit } from '@guildql/testing';
import { useParserCache } from '../src';
import { Plugin } from '@guildql/types';

describe('useParserCache', () => {
  const testSchema = buildSchema(/* GraphQL */ `
    type Query {
      foo: String
    }
  `);

  let testParser: jest.Mock<typeof parse>;
  let useTestPlugin: Plugin;

  beforeEach(() => {
    testParser = jest.fn().mockImplementation((source, options) => parse(source, options));

    useTestPlugin = {
      onParse({ setParseFn }) {
        setParseFn((testParser as any) as typeof parse);
      },
    };
  });

  afterEach(() => {
    testParser.mockReset();
  });

  it('Should call original parse when cache is empty', async () => {
    const testInstance = createTestkit([useTestPlugin, useParserCache()], testSchema);
    await testInstance.execute(`query { foo }`);
    expect(testParser).toHaveBeenCalledTimes(1);
  });

  it('Should call parse once once when operation is cached', async () => {
    const testInstance = createTestkit([useTestPlugin, useParserCache()], testSchema);
    await testInstance.execute(`query { foo }`);
    await testInstance.execute(`query { foo }`);
    await testInstance.execute(`query { foo }`);
    expect(testParser).toHaveBeenCalledTimes(1);
  });

  it('Should call parse once once when operation is cached and errored', async () => {
    const testInstance = createTestkit([useTestPlugin, useParserCache()], testSchema);
    const r1 = await testInstance.execute(`FAILED\ { foo }`);
    const r2 = await testInstance.execute(`FAILED\ { foo }`);
    expect(testParser).toHaveBeenCalledTimes(1);
    expect(r1.errors[0].message).toBe(`Syntax Error: Unexpected Name "FAILED".`);
    expect(r2.errors[0].message).toBe(`Syntax Error: Unexpected Name "FAILED".`);
    expect(r1).toEqual(r2);
  });

  it('Should call parse multiple times on different operations', async () => {
    const testInstance = createTestkit([useTestPlugin, useParserCache()], testSchema);
    await testInstance.execute(`query t { foo }`);
    await testInstance.execute(`query t2 { foo }`);
    expect(testParser).toHaveBeenCalledTimes(2);
  });

  it('should call parse multiple times when operation is invalidated', async () => {
    const testInstance = createTestkit(
      [
        useTestPlugin,
        useParserCache({
          ttl: 1,
        }),
      ],
      testSchema
    );
    await testInstance.execute(`query t { foo }`);
    await testInstance.wait(10);
    await testInstance.execute(`query t { foo }`);
    expect(testParser).toHaveBeenCalledTimes(2);
  });
});