import {Fragment, useRef, useState} from 'react';
import {css} from '@emotion/react';
import {IconAttachment} from '@sentry/icons/attachment';
import {IconIssues} from '@sentry/icons/issues';

import {Avatar} from '@sentry/scraps/avatar';
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
const ALICE: DocumentMention = {
  type: 'mention',
  actorType: 'user',
  id: 'user-1',
  label: 'Alice',
};
const BOB: DocumentMention = {
  type: 'mention',
  actorType: 'user',
  id: 'user-2',
  label: 'Bob',
};
const FRONTEND: DocumentMention = {
  type: 'mention',
  actorType: 'team',
  id: 'team-1',
  label: 'Frontend',
};
const PLATFORM: DocumentMention = {
  type: 'mention',
  actorType: 'team',
  id: 'team-2',
  label: 'Platform',
};
const MENTIONS: readonly DocumentMention[] = [ALICE, BOB, FRONTEND, PLATFORM];
const RETRY_ISSUE: DocumentReference = {
  type: 'reference',
  kind: 'issue',
  id: 'issue-42',
  label: 'WEB-42',
};
const REQUEST_ISSUE: DocumentReference = {
  type: 'reference',
  kind: 'issue',
  id: 'issue-99',
  label: 'WEB-99',
};
const CACHE_ISSUE: DocumentReference = {
  type: 'reference',
  kind: 'issue',
  id: 'issue-128',
  label: 'WEB-128',
};
const RELEASE_ISSUE: DocumentReference = {
  type: 'reference',
  kind: 'issue',
  id: 'issue-256',
  label: 'WEB-256',
};
const ISSUES: readonly DocumentReference[] = [
  RETRY_ISSUE,
  REQUEST_ISSUE,
  CACHE_ISSUE,
  RELEASE_ISSUE,
];
const MENTION_SOURCE = {
  getSuggestions: query =>
    MENTIONS.filter(person => person.label.toLowerCase().includes(query.toLowerCase())),
  renderSuggestion: person => (
    <Flex gap="sm" align="center">
      <Avatar
        type="letter_avatar"
        size={20}
        identifier={person.label}
        name={person.label}
        round={person.actorType === 'user'}
      />
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
        {type: 'text', text: 'I traced the retry path with ', marks: []},
        ALICE,
        {type: 'text', text: ' and the ', marks: []},
        FRONTEND,
        {type: 'text', text: ' team this morning. The behaviour in ', marks: []},
        RETRY_ISSUE,
        {
          type: 'text',
          text: ' matches the report: the first request succeeds, but the next request can still reuse a stale response after the connection has recovered. Before merging, ',
          marks: [],
        },
        BOB,
        {type: 'text', text: ' can compare the request timeline against ', marks: []},
        REQUEST_ISSUE,
        {
          type: 'text',
          text: ' and confirm that the retry keeps the original context. I attached the console output above so everyone can follow the same sequence without reproducing the entire session.',
          marks: [],
        },
      ],
    },
    {
      type: 'paragraph',
      children: [
        {
          type: 'text',
          text: 'The next pass should cover a slow connection, an interrupted request, and a successful retry after navigation. Please keep the original request open while checking the second attempt, then repeat the sequence after clearing the cache. The expected result is one completed report with the latest values, no duplicate notification, and a useful error message when the request cannot recover.',
          marks: [],
        },
      ],
    },
    {
      type: 'paragraph',
      children: [
        {type: 'text', text: 'For the release check, the ', marks: []},
        PLATFORM,
        {type: 'text', text: ' team can verify the cache changes in ', marks: []},
        CACHE_ISSUE,
        {type: 'text', text: ' while ', marks: []},
        ALICE,
        {type: 'text', text: ' reviews the rollout notes in ', marks: []},
        RELEASE_ISSUE,
        {
          type: 'text',
          text: '. Once those checks agree, we can enable the fix for the next test run and watch the retry count. Please add any unexpected response codes to the issue, along with the step that triggered them, so the follow-up stays actionable.',
          marks: [],
        },
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
            Type @ to mention a person or team, or # to reference an issue.
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
                onClick={() => {
                  const replacement = MENTIONS.find(
                    candidate =>
                      candidate.actorType === mention.actorType &&
                      candidate.id !== mention.id
                  );
                  if (replacement) {
                    actions.replace(replacement);
                  }
                }}
              >
                <Text size="md" density="comfortable" tabular variant="primary">
                  <Flex
                    as="span"
                    display="inline-flex"
                    align="center"
                    height="1em"
                    css={css`
                      vertical-align: -0.125em;
                    `}
                  >
                    <Avatar
                      type="letter_avatar"
                      size={14}
                      identifier={mention.label}
                      name={mention.label}
                      round={mention.actorType === 'user'}
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
