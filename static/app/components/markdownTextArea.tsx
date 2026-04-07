import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';
import type {TextAreaProps} from '@sentry/scraps/textarea';
import {TextArea} from '@sentry/scraps/textarea';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconMarkdown} from 'sentry/icons';
import {t} from 'sentry/locale';
interface MarkdownTextAreaProps extends TextAreaProps {
  className?: string;
}

export function MarkdownTextArea({className, ...props}: MarkdownTextAreaProps) {
  return (
    <Container position="relative" className={className}>
      <RightPaddedTextArea autosize rows={5} maxRows={10} {...props} />
      <Container position="absolute" top="8px " right="10px">
        <Tooltip title={t('Markdown supported')}>
          <IconMarkdown size="md" variant="muted" />
        </Tooltip>
      </Container>
    </Container>
  );
}

const RightPaddedTextArea = styled(TextArea)`
  padding-right: ${p => p.theme.space['2xl']};
`;
