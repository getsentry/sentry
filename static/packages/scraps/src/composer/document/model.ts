import {z} from 'zod';

const documentMarkSchema = z.enum(['bold', 'italic', 'strike', 'code']);
const documentTextSchema = z.strictObject({
  type: z.literal('text'),
  text: z.string(),
  marks: z
    .array(documentMarkSchema)
    .transform(marks => documentMarkSchema.options.filter(mark => marks.includes(mark)))
    .readonly(),
});
export const documentMentionSchema = z.strictObject({
  type: z.literal('mention'),
  actorType: z.enum(['user', 'team']),
  id: z.string(),
  label: z.string(),
});
export const documentReferenceSchema = z.strictObject({
  type: z.literal('reference'),
  kind: z.string(),
  id: z.string(),
  label: z.string(),
});
export const documentAttachmentSchema = z.strictObject({
  type: z.literal('attachment'),
  id: z.string(),
  name: z.string(),
  mediaType: z.string(),
});
export const documentInlineSchema = z.discriminatedUnion('type', [
  documentTextSchema,
  documentMentionSchema,
  documentReferenceSchema,
]);
const childrenSchema = z.array(documentInlineSchema).transform(mergeText).readonly();
export const documentRawMarkdownSchema = z.strictObject({
  type: z.literal('rawMarkdown'),
  source: z.string(),
});
export const documentBlockSchema = z.discriminatedUnion('type', [
  z.strictObject({type: z.literal('paragraph'), children: childrenSchema}),
  z.strictObject({type: z.literal('quote'), children: childrenSchema}),
  z.strictObject({type: z.literal('codeBlock'), text: z.string(), language: z.string()}),
  documentAttachmentSchema,
  documentRawMarkdownSchema,
]);
export const composerDocumentSchema = z.strictObject({
  version: z.literal(1),
  blocks: z.array(documentBlockSchema).readonly(),
});

export type DocumentMark = z.infer<typeof documentMarkSchema>;
export type DocumentText = z.infer<typeof documentTextSchema>;
export type DocumentMention = z.infer<typeof documentMentionSchema>;
export type DocumentReference = z.infer<typeof documentReferenceSchema>;
export type DocumentAttachment = z.infer<typeof documentAttachmentSchema>;
export type DocumentInline = z.infer<typeof documentInlineSchema>;
export type DocumentBlock = z.infer<typeof documentBlockSchema>;
export type ComposerDocument = z.infer<typeof composerDocumentSchema>;
export type DocumentAtom =
  | Exclude<DocumentInline, DocumentText>
  | Extract<DocumentBlock, {type: 'attachment' | 'rawMarkdown'}>;

export const EMPTY_DOCUMENT: ComposerDocument = {
  version: 1,
  blocks: [{type: 'paragraph', children: []}],
};

function mergeText(children: DocumentInline[]): DocumentInline[] {
  const merged: DocumentInline[] = [];
  for (const node of children) {
    const previous = merged.at(-1);
    if (node.type === 'text' && node.text === '') {
      continue;
    }
    if (
      node.type === 'text' &&
      previous?.type === 'text' &&
      previous.marks.join() === node.marks.join()
    ) {
      merged[merged.length - 1] = {...previous, text: previous.text + node.text};
    } else {
      merged.push(node);
    }
  }
  return merged;
}

export function parseComposerDocument(value: unknown): ComposerDocument {
  return composerDocumentSchema.parse(value);
}
