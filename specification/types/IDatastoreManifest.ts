import { z } from '@ulixee/specification';
import { addressValidation, identityValidation } from '@ulixee/specification/common';
import { DatastoreCrawlerPricing, DatastoreRunnerPricing } from './IDatastorePricing';
import { datastoreVersionHashValidation } from './datastoreVersionHashValidation';

const minDate = new Date('2022-01-01').getTime();

export const DatastoreManifestSchema = z.object({
  name: z.string().optional(),
  versionHash: datastoreVersionHashValidation,
  domain: z
    .string()
    .optional()
    .describe('A Custom DNS name pointing at the latest version of the Datastore.'),
  versionTimestamp: z.number().int().gt(minDate),
  linkedVersions: z
    .object({
      versionHash: datastoreVersionHashValidation,
      versionTimestamp: z.number().int().gt(minDate),
    })
    .array()
    .describe('Older versions that should be redirected to this version'),
  scriptHash: z
    .string()
    .length(62)
    .regex(
      /^scr1[ac-hj-np-z02-9]{58}/,
      'This is not a Datastore scriptHash (Bech32 encoded hash starting with "scr").',
    ),
  adminIdentities: identityValidation
    .array()
    .describe(
      'Administrators of this Datastore. If none are present, defaults to Administrators on the Miner.',
    ),
  scriptEntrypoint: z.string().describe('A relative path from a project root'),
  coreVersion: z.string().describe('Version of the Datastore Core Runtime'),
  schemaInterface: z.string().optional().describe('The raw typescript schema for this Datastore'),
  runnersByName: z.record(
    z
      .string()
      .regex(/[a-z][A-Za-z0-9]+/)
      .describe('The Runner name'),
    z.object({
      corePlugins: z
        .record(z.string())
        .optional()
        .describe('Plugin dependencies required for execution'),
      schemaAsJson: z
        .object({
          input: z.any().optional(),
          output: z.any().optional(),
          inputExamples: z.any().optional(),
        })
        .optional()
        .describe('The schema as json.'),
      prices: DatastoreRunnerPricing.array()
        .min(1)
        .optional()
        .describe(
          'Price details for a function call. This array will have an entry for each function called in this process. ' +
            'The first entry is the cost of the function packaged in this Datastore.',
        ),
    }),
  ),
  crawlersByName: z.record(
    z
      .string()
      .regex(/[a-z][A-Za-z0-9]+/)
      .describe('The Crawler name'),
    z.object({
      corePlugins: z
        .record(z.string())
        .optional()
        .describe('Plugin dependencies required for execution'),
      schemaAsJson: z
        .object({
          input: z.any().optional(),
          output: z.any().optional(),
          inputExamples: z.any().optional(),
        })
        .optional()
        .describe('The schema as json.'),
      prices: DatastoreCrawlerPricing.array()
        .min(1)
        .optional()
        .describe(
          'Price details for a function call. This array will have an entry for each function called in this process. ' +
            'The first entry is the cost of the function packaged in this Datastore.',
        ),
    }),
  ),
  tablesByName: z.record(
    z
      .string()
      .regex(/[a-z][A-Za-z0-9]+/)
      .describe('The Table name'),
    z.object({
      schemaAsJson: z.record(z.string(), z.any()).optional().describe('The schema as json.'),
      prices: z
        .object({
          perQuery: z.number().int().nonnegative().describe('Base price per query.'),
          remoteMeta: z
            .object({
              host: z.string().describe('The remote host'),
              datastoreVersionHash: datastoreVersionHashValidation,
              tableName: z.string().describe('The remote table name'),
            })
            .optional(),
        })
        .array()
        .min(1)
        .optional()
        .describe(
          'Price details for a table call. This array will have an entry for each table called in this process. ' +
            'The first entry is the cost of the table packaged in this Datastore.',
        ),
    }),
  ),
  paymentAddress: addressValidation.optional(),
});

export type IVersionHistoryEntry = z.infer<
  typeof DatastoreManifestSchema.shape.linkedVersions.element
>;
type IDatastoreManifest = z.infer<typeof DatastoreManifestSchema>;

export default IDatastoreManifest;
