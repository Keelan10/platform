import { z } from '@ulixee/specification';
import { IZodSchemaToApiTypes } from '@ulixee/specification/utils/IZodApi';
import {
  identityValidation,
  micronoteTokenValidation,
  signatureValidation,
} from '@ulixee/specification/common';
import { PaymentSchema } from '../types/IPayment';
import {
  DatastoreCrawlerPricing,
  DatastoreRunnerPricing,
  DatastoreTablePricing,
} from '../types/IDatastorePricing';
import { DatastoreStatsSchema } from '../types/IDatastoreStats';
import { datastoreVersionHashValidation } from '../types/datastoreVersionHashValidation';

const FunctionMetaSchema = z.object({
  stats: DatastoreStatsSchema,
  pricePerQuery: micronoteTokenValidation.describe('The base price per query.'),
  minimumPrice: micronoteTokenValidation.describe(
    'Minimum microgons that must be allocated for a query to be accepted.',
  ),
  schemaJson: z.any().optional().describe('The schema JSON if requested'),
});

export const DatastoreApiSchemas = {
  'Datastore.upload': {
    args: z.object({
      compressedDatastore: z.instanceof(Buffer).describe('Bytes of a compressed .dbx file'),
      allowNewLinkedVersionHistory: z
        .boolean()
        .describe(
          'Allow this upload to start a new version chain (do not link to previous versions)',
        ),
      adminIdentity: identityValidation
        .optional()
        .describe(
          'If this server is in production mode, an AdminIdentity approved on the Server or Datastore.',
        ),
      adminSignature: signatureValidation
        .optional()
        .describe('A signature from an approved AdminIdentity'),
    }),
    result: z.object({
      success: z.boolean(),
    }),
  },
  'Datastore.creditsBalance': {
    args: z.object({
      datastoreVersionHash: datastoreVersionHashValidation.describe(
        'The hash of the Datastore version to look at credits for.',
      ),
      creditId: z.string().describe('CreditId issued by this datastore.'),
    }),
    result: z.object({
      issuedCredits: micronoteTokenValidation.describe('Issued credits balance in microgons.'),
      balance: micronoteTokenValidation.describe('Remaining credits balance in microgons.'),
    }),
  },
  'Datastore.admin': {
    args: z.object({
      versionHash: datastoreVersionHashValidation.describe(
        'The hash of a unique datastore version',
      ),
      adminIdentity: identityValidation
        .optional()
        .describe('An admin Identity for this Datastore.'),
      adminSignature: signatureValidation
        .optional()
        .describe('A signature from the admin Identity'),
      adminFunction: z.object({
        ownerType: z
          .enum(['table', 'crawler', 'runner', 'datastore'])
          .describe('Where to locate the function.'),
        ownerName: z
          .string()
          .describe('The name of the owning runner, table or crawler (if applicable).')
          .optional(),
        functionName: z.string().describe('The name of the function'),
      }),
      functionArgs: z.any().array().describe('The args to provide to the function.'),
    }),
    result: z.any().describe('A flexible result based on the type of api.'),
  },
  'Datastores.list': {
    args: z.object({
      adminIdentity: identityValidation
        .optional()
        .describe('An admin Identity for this Cloud node.'),
      adminSignature: signatureValidation
        .optional()
        .describe('A signature from the admin Identity'),
    }),
    result: z
      .object({
        name: z.string().optional(),
        versionHash: datastoreVersionHashValidation,
        domain: z
          .string()
          .optional()
          .describe('A Custom DNS name pointing at the latest version of the Datastore.'),
        latestVersionHash: datastoreVersionHashValidation.describe(
          'The latest version hash of this datastore',
        ),
        runnersByName: z.record(
          z.string().describe('The name of the runner'),
          FunctionMetaSchema.extend({
            priceBreakdown: DatastoreRunnerPricing.array(),
          }),
        ),
        crawlersByName: z.record(
          z.string().describe('The name of the cralwer'),
          FunctionMetaSchema.extend({
            priceBreakdown: DatastoreCrawlerPricing.array(),
          }),
        ),
        tablesByName: z.record(
          z.string().describe('The name of a table'),
          z.object({
            stats: DatastoreStatsSchema,
            pricePerQuery: micronoteTokenValidation.describe('The table base price per query.'),
            priceBreakdown: DatastoreTablePricing.array(),
            schemaJson: z.any().optional().describe('The schema JSON if requested'),
          }),
        ),
        computePricePerQuery: micronoteTokenValidation.describe(
          'The current server price per query. NOTE: if a server is implementing surge pricing, this amount could vary.',
        ),
      })
      .array(),
  },
  'Datastore.meta': {
    args: z.object({
      versionHash: datastoreVersionHashValidation.describe(
        'The hash of a unique datastore version',
      ),
      includeSchemasAsJson: z
        .boolean()
        .optional()
        .describe('Include JSON describing the schema for each function'),
    }),
    result: z.object({
      name: z.string().optional(),
      versionHash: datastoreVersionHashValidation,
      latestVersionHash: datastoreVersionHashValidation.describe(
        'The latest version hash of this datastore',
      ),
      runnersByName: z.record(
        z.string().describe('The name of the runner'),
        FunctionMetaSchema.extend({
          priceBreakdown: DatastoreRunnerPricing.array(),
        }),
      ),
      crawlersByName: z.record(
        z.string().describe('The name of the cralwer'),
        FunctionMetaSchema.extend({
          priceBreakdown: DatastoreCrawlerPricing.array(),
        }),
      ),
      tablesByName: z.record(
        z.string().describe('The name of a table'),
        z.object({
          stats: DatastoreStatsSchema,
          pricePerQuery: micronoteTokenValidation.describe('The table base price per query.'),
          priceBreakdown: DatastoreTablePricing.array(),
          schemaJson: z.any().optional().describe('The schema JSON if requested'),
        }),
      ),
      schemaInterface: z
        .string()
        .optional()
        .describe(
          'A Typescript interface describing input and outputs of Datastore Runners, and schemas of Datastore Tables',
        ),
      computePricePerQuery: micronoteTokenValidation.describe(
        'The current server price per query. NOTE: if a server is implementing surge pricing, this amount could vary.',
      ),
    }),
  },
  'Datastore.stream': {
    args: z.object({
      streamId: z.string().describe('The streamId to push results for this query.'),
      name: z.string().describe('The name of the table or function'),
      input: z.any().optional().describe('Optional input or where parameters'),
      versionHash: datastoreVersionHashValidation.describe(
        'The hash of this unique datastore version',
      ),
      payment: PaymentSchema.optional().describe('Payment for this request.'),
      affiliateId: z
        .string()
        .regex(/aff[a-zA-Z_0-9-]{10}/)
        .optional()
        .describe('A tracking id to attribute payments to source affiliates.'),
      authentication: z
        .object({
          identity: identityValidation,
          signature: signatureValidation,
          nonce: z.string().length(10).describe('A random nonce adding signature noise.'),
        })
        .optional(),
      pricingPreferences: z
        .object({
          maxComputePricePerQuery: micronoteTokenValidation.describe(
            'Maximum price to pay for compute costs per query (NOTE: This only applies to Servers implementing surge pricing).',
          ),
        })
        .optional(),
    }),
    result: z.object({
      latestVersionHash: datastoreVersionHashValidation,
      metadata: z
        .object({
          microgons: micronoteTokenValidation,
          bytes: z.number().int().nonnegative(),
          milliseconds: z.number().int().nonnegative(),
        })
        .optional(),
    }),
  },
  'Datastore.fetchInternalTable': {
    args: z.object({
      name: z.string().describe('The name of the table'),
      input: z.any().optional().describe('Optional input or where parameters'),
      datastoreVersionHash: z.string().optional(),
      datastoreInstanceId: z.string().optional(),
    }),
    result: z.any({}),
  },
  'Datastore.query': {
    args: z.object({
      sql: z.string().describe('The SQL command(s) you want to run'),
      boundValues: z
        .array(z.any())
        .optional()
        .describe('An array of values you want to use as bound parameters'),
      versionHash: datastoreVersionHashValidation.describe(
        'The hash of this unique datastore version',
      ),
      affiliateId: z
        .string()
        .regex(/aff[a-zA-Z_0-9-]{10}/)
        .optional()
        .describe('A tracking id to attribute payments to source affiliates.'),
      payment: PaymentSchema.optional().describe(
        'Payment for this request created with an approved Ulixee Sidechain.',
      ),
      authentication: z
        .object({
          identity: identityValidation,
          signature: signatureValidation,
          nonce: z.string().length(10).describe('A random nonce adding signature noise.'),
        })
        .optional(),
      pricingPreferences: z
        .object({
          maxComputePricePerQuery: micronoteTokenValidation.describe(
            'Maximum price to pay for compute costs per query (NOTE: This only applies to Servers implementing surge pricing).',
          ),
        })
        .optional(),
    }),
    result: z.object({
      latestVersionHash: datastoreVersionHashValidation,
      outputs: z.any().array(),
      metadata: z
        .object({
          microgons: micronoteTokenValidation,
          bytes: z.number().int().nonnegative(),
          milliseconds: z.number().int().nonnegative(),
        })
        .optional(),
    }),
  },
  'Datastore.queryLocalScript': {
    args: z.object({
      sql: z.string().describe('The SQL command(s) you want to run'),
      boundValues: z
        .array(z.any())
        .optional()
        .describe('An array of values you want to use as bound parameters'),
      scriptPath: z
        .string()
        .describe('A path to a local script to run. NOTE: API only enabled in development.'),
    }),
    result: z.object({
      latestVersionHash: datastoreVersionHashValidation,
      outputs: z.any().array(),
      error: z.any().optional(),
    }),
  },
  'Datastore.createInMemoryTable': {
    args: z.object({
      name: z.string(),
      schema: z.any({}),
      seedlings: z.any({}).optional(),
      datastoreInstanceId: z.string(),
    }),
    result: z.object({}),
  },
  'Datastore.createInMemoryFunction': {
    args: z.object({
      name: z.string(),
      schema: z.any({}),
      datastoreInstanceId: z.string(),
    }),
    result: z.object({}),
  },
  'Datastore.queryInternalTable': {
    args: z.object({
      name: z.string(),
      sql: z.string(),
      boundValues: z.any({}).optional(),
      datastoreVersionHash: z.string().optional(),
      datastoreInstanceId: z.string().optional(),
    }),
    result: z.any({}),
  },
  'Datastore.queryInternalFunctionResult': {
    args: z.object({
      name: z.string(),
      sql: z.string(),
      boundValues: z.any({}).optional(),
      input: z.any({}).optional(),
      outputs: z.array(z.any({})),
      datastoreVersionHash: z.string().optional(),
      datastoreInstanceId: z.string().optional(),
    }),
    result: z.any({}),
  },
  'Datastore.queryInternal': {
    args: z.object({
      sql: z.string(),
      boundValues: z.any({}).optional(),
      inputByRunnerName: z.record(z.any()),
      outputByRunnerName: z.record(z.array(z.any({}))),
      recordsByVirtualTableName: z.record(
        z.string({ description: 'Virtual Table Name' }),
        z.record(z.string(), z.any(), { description: 'Virtual Table Record' }).array(),
      ),
      datastoreVersionHash: z.string().optional(),
      datastoreInstanceId: z.string().optional(),
    }),
    result: z.any({}),
  },
};

type IDatastoreApiTypes = IZodSchemaToApiTypes<typeof DatastoreApiSchemas>;

export default IDatastoreApiTypes;
