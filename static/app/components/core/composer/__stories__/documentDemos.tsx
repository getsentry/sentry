import {Fragment, useRef, useState} from 'react';
import {css} from '@emotion/react';
import {IconAttachment} from '@sentry/icons/attachment';
import {IconIssues} from '@sentry/icons/issues';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {
  DocumentComposer,
  documentFromMarkdown,
  documentToMarkdown,
  parseComposerDocument,
  type ComposerDocument,
  type DocumentComposerHandle,
  type DocumentMention,
  type DocumentReference,
  type DocumentSuggestionSource,
} from '@sentry/scraps/composer/document';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

const SAVED_DRAFT_KEY = 'scraps-composer-document-spike';
const PEOPLE: readonly DocumentMention[] = [
  {type: 'mention', actorType: 'user', id: 'user-1', label: 'Alice'},
  {type: 'mention', actorType: 'user', id: 'user-2', label: 'Bob'},
];
const ISSUES: readonly DocumentReference[] = [
  {type: 'reference', kind: 'issue', id: 'issue-42', label: 'WEB-42'},
  {type: 'reference', kind: 'issue', id: 'issue-99', label: 'WEB-99'},
];
const MENTION_SOURCE = {
  getSuggestions: query =>
    PEOPLE.filter(person => person.label.toLowerCase().includes(query.toLowerCase())),
  renderSuggestion: person => (
    <Flex gap="sm" align="center">
      <UserAvatar size={20} user={{id: person.id, name: person.label, type: 'user'}} />
      <Text tabular>{person.label}</Text>
    </Flex>
  ),
} satisfies DocumentSuggestionSource<DocumentMention>;
const REFERENCE_SOURCE = {
  getSuggestions: query =>
    ISSUES.filter(issue => issue.label.toLowerCase().includes(query.toLowerCase())),
  renderSuggestion: issue => (
    <Flex gap="sm" align="center">
      <IconIssues size="xs" />
      <Text tabular>{issue.label}</Text>
    </Flex>
  ),
} satisfies DocumentSuggestionSource<DocumentReference>;
const INITIAL_DOCUMENT: ComposerDocument = {
  version: 1,
  blocks: [
    {
      type: 'attachment',
      id: 'attachment-1',
      name: 'console.txt',
      mediaType: 'text/plain',
    },
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
  ],
};

export function DocumentComposerDemo() {
  const editor = useRef<DocumentComposerHandle>(null);
  const [value, setValue] = useState(INITIAL_DOCUMENT);
  const [pendingFiles, setPendingFiles] = useState<readonly File[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [markdown, setMarkdown] = useState(() => documentToMarkdown(INITIAL_DOCUMENT));
  const [status, setStatus] = useState('');
  const queueFiles = (files: readonly File[]) => {
    setIsDraggingFiles(false);
    setPendingFiles(current => [...current, ...files]);
  };

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
      <Container
        role="group"
        aria-label="Composer dropzone"
        position="relative"
        border={isDraggingFiles ? 'accent' : 'primary'}
        background="secondary"
        radius="lg"
        padding="lg"
        onDragEnter={event => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
            setIsDraggingFiles(true);
          }
        }}
        onDragOver={event => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDragLeave={event => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          ) {
            setIsDraggingFiles(false);
          }
        }}
        onDrop={event => {
          setIsDraggingFiles(false);
          if (!event.defaultPrevented && event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
            queueFiles(Array.from(event.dataTransfer.files));
          }
        }}
      >
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
          </Flex>
          <Text id="document-composer-hint" size="sm" variant="muted">
            Type @ to mention someone or # to reference an issue.
          </Text>
          {pendingFiles.length > 0 && (
            <Flex gap="sm" wrap="wrap" aria-label="Pending attachments">
              {pendingFiles.map((file, index) => (
                <Flex
                  key={`${file.name}:${index}`}
                  background="primary"
                  border="muted"
                  radius="sm"
                  padding="sm"
                  gap="md"
                  align="center"
                  maxWidth="100%"
                >
                  <Flex
                    align="center"
                    justify="center"
                    width="80px"
                    height="80px"
                    flexShrink={0}
                    border="muted"
                    radius="sm"
                    background="primary"
                  >
                    <IconAttachment size="lg" />
                  </Flex>
                  <Stack gap="sm" minWidth="0">
                    <Text size="sm" ellipsis>
                      {file.name}
                    </Text>
                    <Flex gap="sm">
                      <Button
                        size="xs"
                        aria-label={`Insert ${file.name}`}
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
                        Insert
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
                  </Stack>
                </Flex>
              ))}
            </Flex>
          )}
          <DocumentComposer
            ref={editor}
            aria-label="Comment document"
            aria-describedby="document-composer-hint"
            value={value}
            onChange={setValue}
            mentionSource={MENTION_SOURCE}
            referenceSource={REFERENCE_SOURCE}
            onFilesDrop={queueFiles}
            renderMention={(mention, actions) => (
              <Button
                size="zero"
                variant="link"
                aria-label={`Change mention ${mention.label}`}
                onClick={() =>
                  actions.replace({
                    ...mention,
                    id: mention.id === 'user-1' ? 'user-2' : 'user-1',
                    label: mention.label === 'Alice' ? 'Bob' : 'Alice',
                  })
                }
              >
                <Text size="md" density="comfortable" tabular variant="primary">
                  <Flex
                    as="span"
                    display="inline-flex"
                    align="center"
                    height="1em"
                    css={css`
                      vertical-align: text-bottom;
                    `}
                  >
                    <UserAvatar
                      size={14}
                      user={{id: mention.id, name: mention.label, type: 'user'}}
                    />
                  </Flex>{' '}
                  {mention.label}
                </Text>
              </Button>
            )}
            renderReference={(reference, actions) => (
              <Button
                size="zero"
                aria-label={`Change reference ${reference.label}`}
                onClick={() =>
                  actions.replace({
                    ...reference,
                    id: reference.id === 'issue-42' ? 'issue-99' : 'issue-42',
                    label: reference.label === 'WEB-42' ? 'WEB-99' : 'WEB-42',
                  })
                }
              >
                <Text size="sm" tabular variant="inherit">
                  {reference.kind === 'issue' && (
                    <Fragment>
                      <Flex
                        as="span"
                        display="inline-flex"
                        align="center"
                        height="1em"
                        css={css`
                          vertical-align: -0.125em;
                        `}
                      >
                        <IconIssues size="xs" />
                      </Flex>{' '}
                      Issue:{' '}
                    </Fragment>
                  )}
                  <Text size="sm" bold tabular variant="inherit">
                    {reference.label}
                  </Text>
                </Text>
              </Button>
            )}
            renderAttachment={(attachment, actions) => (
              <Flex
                gap="md"
                align="center"
                width="fit-content"
                maxWidth="100%"
                background="primary"
                border="muted"
                radius="sm"
                padding="sm"
              >
                <Flex
                  align="center"
                  justify="center"
                  width="80px"
                  height="80px"
                  flexShrink={0}
                  border="muted"
                  radius="sm"
                  background="primary"
                >
                  <IconAttachment size="lg" />
                </Flex>
                <Stack gap="sm" minWidth="0">
                  <Text size="sm" ellipsis>
                    {attachment.name}
                  </Text>
                  <Button
                    size="xs"
                    aria-label={`Remove attachment ${attachment.name}`}
                    onClick={actions.remove}
                  >
                    Remove
                  </Button>
                </Stack>
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
        {isDraggingFiles && (
          <Stack
            role="status"
            position="absolute"
            inset="0"
            style={{zIndex: 2}}
            align="center"
            justify="center"
            gap="md"
            border="accent"
            radius="lg"
            background="primary"
            pointerEvents="none"
          >
            <IconAttachment size="lg" />
            <Text bold>Drop files to attach</Text>
          </Stack>
        )}
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
