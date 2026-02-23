import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {closeModal, openModal} from 'sentry/actionCreators/modal';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {extractDomTree} from 'sentry/utils/replays/extractDomTree';

interface Props {
  element: HTMLElement;
  onClose: () => void;
  onSend: (message: string) => void;
  promptContext: {
    currentTimestampMs: number;
    currentUrl: string;
    replayId?: string;
  };
}

function getElementPreview(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = Array.from(element.classList)
    .filter(cls => !cls.startsWith('rr-') && !cls.startsWith('rr_'))
    .slice(0, 3)
    .map(cls => `.${cls}`)
    .join('');
  const component = element.getAttribute('data-sentry-component');

  if (component) {
    return `<${component}> (${tag}${id}${classes})`;
  }
  return `<${tag}${id}${classes}>`;
}

function getHtmlSnippet(element: HTMLElement): string {
  let html = element.outerHTML;
  if (html.length > 200) {
    html = html.substring(0, 200) + '...';
  }
  return html;
}

function InspectElementModalContent({
  element,
  Header,
  Body,
  Footer,
  closeModal: closeModalProp,
  onClose,
  onSend,
  promptContext: {replayId, currentTimestampMs, currentUrl},
}: ModalRenderProps & Props) {
  const [prompt, setPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-focus the textarea
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    setIsSending(true);

    const domTree = extractDomTree(element);
    const trimmedPrompt = prompt.trim();
    const message = `I'm viewing a replay with id: ${replayId}
Replay is at timestamp (ms): ${currentTimestampMs}
Replay is on URL: ${currentUrl}

I have specifically selected the below DOM snippet where you should focus your attention on:
${domTree}

${trimmedPrompt || 'Analyze this element from a session replay'}`;

    closeModalProp();
    onSend(message);
  }, [element, prompt, replayId, currentTimestampMs, currentUrl, closeModalProp, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSend();
      }
    },
    [handleSend]
  );

  const preview = getElementPreview(element);
  const snippet = getHtmlSnippet(element);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Inspect Element')}</h4>
      </Header>
      <Body>
        <Flex direction="column" gap="md">
          <ElementPreview>
            <PreviewLabel>{preview}</PreviewLabel>
            <CodeSnippet>{snippet}</CodeSnippet>
          </ElementPreview>
          <Textarea
            ref={textareaRef}
            placeholder={t(
              'What would you like to investigate about this element? (optional)'
            )}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
          />
        </Flex>
      </Body>
      <Footer>
        <Flex justify="end" gap="md">
          <Button
            onClick={() => {
              closeModalProp();
              onClose();
            }}
          >
            {t('Cancel')}
          </Button>
          <Button priority="primary" onClick={handleSend} disabled={isSending}>
            {t('Send to Seer')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

/**
 * Renders nothing visually — triggers an openModal() call when mounted,
 * and calls onClose when the modal is dismissed.
 */
export default function InspectElementModal({
  element,
  promptContext,
  onClose,
  onSend,
}: Props) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;
  const promptContextRef = useRef(promptContext);
  promptContextRef.current = promptContext;

  useEffect(() => {
    openModal(
      deps => (
        <InspectElementModalContent
          {...deps}
          element={element}
          promptContext={promptContextRef.current}
          onClose={() => onCloseRef.current()}
          onSend={(message: string) => onSendRef.current(message)}
        />
      ),
      {
        modalCss: modalStyles,
        onClose: () => onCloseRef.current(),
      }
    );

    return () => {
      closeModal();
    };
  }, [element]);

  return null;
}

const modalStyles = css`
  max-width: 560px;
`;

const ElementPreview = styled('div')`
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(1.5)};
  overflow: hidden;
`;

const PreviewLabel = styled('div')`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-bottom: ${space(1)};
  color: ${p => p.theme.tokens.content.primary};
`;

const CodeSnippet = styled('pre')`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  max-height: 120px;
  overflow-y: auto;
`;

const Textarea = styled('textarea')`
  width: 100%;
  resize: vertical;
  font-family: ${p => p.theme.font.family.sans};
  font-size: ${p => p.theme.font.size.md};
  padding: ${space(1)};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};

  &:focus {
    outline: none;
    border-color: ${p => p.theme.tokens.focus.default};
    box-shadow: ${p => p.theme.tokens.focus.default} 0 0 0 1px;
  }
`;
