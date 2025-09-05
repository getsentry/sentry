import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text/text';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import Comment from './comment';
import type {GitHubComment} from './types';

interface Props extends ModalRenderProps {
  comment: GitHubComment;
  filename: string;
  onRun: (instructions: string) => void;
}

function FixWithSeerModal({
  Body,
  Header,
  Footer,
  filename,
  comment,
  onRun,
  closeModal,
}: Props) {
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    try {
      await onRun(instructions);
      closeModal();
    } catch (error) {
      // Handle error - could add toast notification
      // TODO: Add proper error handling
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    closeModal();
  };

  return (
    <Fragment>
      <Header closeButton>
        <HeaderContent align="center" gap="sm">
          <IconSeer size="sm" />
          {t('Fix with Seer')}
        </HeaderContent>
      </Header>

      <Body>
        <ContentSection direction="column" gap="md">
          <Text>
            {t('Fix the selected comment in ')}
            <CodeHighlight>{filename}</CodeHighlight>
            {t(' with AI assistance')}
          </Text>

          <CommentSection direction="column" gap="sm">
            <Text as="label" bold size="sm">
              {t('Comment to fix:')}
            </Text>
            <CommentPreview>
              <Comment comment={comment} />
            </CommentPreview>
          </CommentSection>

          <InputSection direction="column" gap="sm">
            <Text as="label" bold size="sm">
              {t('Additional context (optional):')}
            </Text>
            <InstructionsTextarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder={t(
                "Describe what specific issue you'd like help with, or provide context about the expected behavior..."
              )}
              rows={4}
            />
            <Text variant="muted" size="xs">
              {t('Provide specific context to help Seer give more targeted suggestions')}
            </Text>
          </InputSection>
        </ContentSection>
      </Body>

      <Footer>
        <FooterButtons justify="end" gap="sm">
          <Button onClick={handleCancel} disabled={loading}>
            {t('Cancel')}
          </Button>
          <Button
            priority="primary"
            onClick={handleRun}
            disabled={loading}
            icon={loading ? undefined : <IconSeer />}
          >
            {loading ? t('Analyzing...') : t('Start Seer fix')}
          </Button>
        </FooterButtons>
      </Footer>
    </Fragment>
  );
}

const HeaderContent = styled(Flex)`
  font-weight: 600;
`;

const ContentSection = styled(Flex)`
  padding: ${space(1)};
`;

const InputSection = styled(Flex)`
  margin-top: ${space(2)};
`;

const InstructionsTextarea = styled('textarea')`
  min-height: 100px;
  padding: ${space(1.5)};
  border: 1px solid ${p => p.theme.border};
  border-radius: 4px;
  font-family: inherit;
  font-size: ${p => p.theme.fontSize.sm};
  resize: vertical;
  background: ${p => p.theme.background};
  width: 100%;

  &:focus {
    outline: none;
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 0 0 1px ${p => p.theme.purple300};
  }

  &::placeholder {
    color: ${p => p.theme.gray300};
  }
`;

const FooterButtons = styled(Flex)`
  padding: ${space(1)} 0;
`;

const CodeHighlight = styled('code')`
  background: ${p => p.theme.gray100};
  padding: ${space(0.25)} ${space(0.5)};
  border-radius: 3px;
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.purple300};
  font-weight: 500;
`;

const CommentSection = styled(Flex)`
  margin-top: ${space(2)};
`;

const CommentPreview = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  background: ${p => p.theme.background};
  max-height: 200px;
  overflow-y: auto;

  /* Remove margins from the nested Comment component */
  > div {
    margin: 0;
    border: none;
    border-radius: inherit;
  }
`;

export default FixWithSeerModal;
