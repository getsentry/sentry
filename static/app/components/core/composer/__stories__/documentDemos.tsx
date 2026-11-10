import {useRef, useState} from 'react';
import {IconAttachment} from '@sentry/icons/attachment';
import {IconUser} from '@sentry/icons/user';

import {Button} from '@sentry/scraps/button';
import {
  DocumentComposer,
  documentFromMarkdown,
  documentToMarkdown,
  parseComposerDocument,
  type ComposerDocument,
  type DocumentComposerHandle,
} from '@sentry/scraps/composer/document';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

const SAVED_DRAFT_KEY = 'scraps-composer-document-spike';
const INITIAL_DOCUMENT: ComposerDocument = {
  version: 1,
  blocks: [
    {
      type: 'paragraph',
      children: [
        {type: 'text', text: 'Hey ', marks: []},
        {type: 'mention', actorType: 'user', id: 'user-1', label: 'Alice'},
        {type: 'text', text: ', please check ', marks: []},
        {type: 'reference', kind: 'issue', id: 'issue-42', label: 'WEB-42'},
        {type: 'text', text: ' ', marks: []},
        {type: 'text', text: 'before merging.', marks: ['bold']},
      ],
    },
    {
      type: 'quote',
      children: [
        {type: 'text', text: 'The regression happens after the retry.', marks: []},
      ],
    },
    {
      type: 'codeBlock',
      language: 'typescript',
      text: 'await retry(() => fetchReport());',
    },
    {
      type: 'attachment',
      id: 'attachment-1',
      name: 'console.txt',
      mediaType: 'text/plain',
    },
  ],
};

export function DocumentComposerDemo() {
  const editor = useRef<DocumentComposerHandle>(null);
  const [value, setValue] = useState(INITIAL_DOCUMENT);
  const [pendingFiles, setPendingFiles] = useState<readonly File[]>([]);
  const [markdown, setMarkdown] = useState(() => documentToMarkdown(INITIAL_DOCUMENT));
  const [status, setStatus] = useState('');
  const queueFiles = (files: readonly File[]) =>
    setPendingFiles(current => [...current, ...files]);

  return (
    <Stack gap="lg" width="100%">
      <Flex align="center" justify="between" gap="md" wrap="wrap">
        <Stack gap="xs">
          <Heading as="h3" size="lg">
            Comment document spike
          </Heading>
          <Text variant="muted">
            React references, a versioned tree, and a Markdown codec.
          </Text>
        </Stack>
        <Flex gap="sm">
          <Button
            onClick={() => {
              localStorage.setItem(SAVED_DRAFT_KEY, JSON.stringify(value));
              setStatus('Saved this draft in this browser.');
            }}
          >
            Save draft
          </Button>
          <Button
            onClick={() => {
              const saved = localStorage.getItem(SAVED_DRAFT_KEY);
              if (!saved) {
                setStatus('No saved draft yet.');
                return;
              }
              try {
                setValue(parseComposerDocument(JSON.parse(saved)));
                setStatus('Restored the saved document, including reference IDs.');
              } catch {
                setStatus('The saved draft is invalid.');
              }
            }}
          >
            Restore draft
          </Button>
          <Button onClick={() => setValue(INITIAL_DOCUMENT)}>Reset example</Button>
        </Flex>
      </Flex>
      <Container border="primary" radius="md" padding="lg">
        <Stack gap="md">
          <Flex gap="xs" wrap="wrap" onMouseDown={event => event.preventDefault()}>
            <Button size="sm" onClick={() => editor.current?.formatText('bold')}>
              Bold
            </Button>
            <Button size="sm" onClick={() => editor.current?.formatText('italic')}>
              Italic
            </Button>
            <Button size="sm" onClick={() => editor.current?.formatText('code')}>
              Inline code
            </Button>
            <Button size="sm" onClick={() => editor.current?.setBlockType('paragraph')}>
              Paragraph
            </Button>
            <Button size="sm" onClick={() => editor.current?.setBlockType('quote')}>
              Quote
            </Button>
            <Button size="sm" onClick={() => editor.current?.setBlockType('codeBlock')}>
              Code block
            </Button>
            <Button
              size="sm"
              onClick={() =>
                editor.current?.insertMention({
                  type: 'mention',
                  actorType: 'user',
                  id: 'user-2',
                  label: 'Bob',
                })
              }
            >
              Insert mention
            </Button>
            <Button
              size="sm"
              onClick={() =>
                editor.current?.insertReference({
                  type: 'reference',
                  kind: 'issue',
                  id: 'issue-99',
                  label: 'WEB-99',
                })
              }
            >
              Insert reference
            </Button>
          </Flex>
          {pendingFiles.length > 0 && (
            <Flex gap="sm" wrap="wrap" aria-label="Pending attachments">
              {pendingFiles.map((file, index) => (
                <Container
                  key={`${file.name}:${index}`}
                  background="secondary"
                  radius="md"
                  padding="sm"
                >
                  <Flex gap="sm" align="center">
                    <IconAttachment size="sm" />
                    <Text>{file.name}</Text>
                    <Button
                      size="xs"
                      onClick={() => {
                        editor.current?.insertAttachment({
                          type: 'attachment',
                          id: crypto.randomUUID(),
                          name: file.name,
                          mediaType: file.type || 'application/octet-stream',
                        });
                        setPendingFiles(files =>
                          files.filter((_, candidate) => candidate !== index)
                        );
                      }}
                    >
                      Insert {file.name}
                    </Button>
                    <Button
                      size="xs"
                      aria-label={`Remove pending ${file.name}`}
                      onClick={() =>
                        setPendingFiles(files =>
                          files.filter((_, candidate) => candidate !== index)
                        )
                      }
                    >
                      Remove
                    </Button>
                  </Flex>
                </Container>
              ))}
            </Flex>
          )}
          <DocumentComposer
            ref={editor}
            aria-label="Comment document"
            value={value}
            onChange={setValue}
            onFilesDrop={queueFiles}
            renderMention={(mention, actions) => (
              <Button
                size="zero"
                variant="transparent"
                aria-label={`Change mention ${mention.label}`}
                onClick={() =>
                  actions.replace({
                    ...mention,
                    id: mention.id === 'user-1' ? 'user-2' : 'user-1',
                    label: mention.label === 'Alice' ? 'Bob' : 'Alice',
                  })
                }
              >
                <IconUser size="xs" /> @{mention.label}
              </Button>
            )}
            renderReference={(reference, actions) => (
              <Button
                size="zero"
                variant="link"
                aria-label={`Change reference ${reference.label}`}
                onClick={() =>
                  actions.replace({
                    ...reference,
                    id: reference.id === 'issue-42' ? 'issue-99' : 'issue-42',
                    label: reference.label === 'WEB-42' ? 'WEB-99' : 'WEB-42',
                  })
                }
              >
                {reference.label}
              </Button>
            )}
            renderAttachment={(attachment, actions) => (
              <Flex gap="sm" align="center">
                <IconAttachment size="sm" />
                <Text>{attachment.name}</Text>
                <Button
                  size="xs"
                  aria-label={`Remove attachment ${attachment.name}`}
                  onClick={actions.remove}
                >
                  Remove
                </Button>
              </Flex>
            )}
          />
          <Flex gap="md" align="center">
            <Text as="label" htmlFor="document-spike-files" wrap="nowrap">
              Choose attachments
            </Text>
            <Input
              id="document-spike-files"
              type="file"
              multiple
              onChange={event => {
                queueFiles(Array.from(event.currentTarget.files ?? []));
                event.currentTarget.value = '';
              }}
            />
          </Flex>
        </Stack>
      </Container>
      <Text role="status" variant="muted">
        {status ||
          'No server requests. Uploads are represented by the app-owned attachment bar.'}
      </Text>
      <Grid columns={{xs: '1fr', lg: '1fr 1fr'}} gap="lg">
        <Stack gap="sm">
          <Heading as="h4" size="md">
            Versioned document
          </Heading>
          <TextArea
            aria-label="Document JSON"
            readOnly
            value={JSON.stringify(value, null, 2)}
            rows={18}
          />
        </Stack>
        <Stack gap="sm">
          <Heading as="h4" size="md">
            Markdown codec experiment
          </Heading>
          <Flex gap="sm">
            <Button
              size="sm"
              onClick={() => {
                try {
                  setMarkdown(documentToMarkdown(value));
                  setStatus('Exported Markdown with identities preserved.');
                } catch (error) {
                  setStatus(
                    error instanceof Error ? error.message : 'Markdown export failed.'
                  );
                }
              }}
            >
              Export Markdown
            </Button>
            <Button size="sm" onClick={() => setValue(documentFromMarkdown(markdown))}>
              Load Markdown
            </Button>
          </Flex>
          <TextArea
            aria-label="Markdown source"
            value={markdown}
            onChange={event => setMarkdown(event.currentTarget.value)}
            rows={18}
          />
        </Stack>
      </Grid>
    </Stack>
  );
}
