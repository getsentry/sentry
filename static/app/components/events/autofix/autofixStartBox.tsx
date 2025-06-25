import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import starImage from 'sentry-images/spot/banner-star.svg';

import {Button} from 'sentry/components/core/button';
import {TextArea} from 'sentry/components/core/textarea';
import {IconArrow, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface AutofixStartBoxProps {
  groupId: string;
  onSend: (message: string) => void;
}

export function AutofixStartBox({onSend, groupId}: AutofixStartBoxProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend(message);
  };

  return (
    <Wrapper>
      <ScaleContainer>
        <StyledArrow direction="down" size="sm" />
        <Container>
          <AutofixStartText>
            <BackgroundStar
              src={starImage}
              style={{
                width: '20px',
                height: '20px',
                right: '5%',
                top: '20%',
                transform: 'rotate(15deg)',
              }}
            />
            <BackgroundStar
              src={starImage}
              style={{
                width: '16px',
                height: '16px',
                right: '35%',
                top: '40%',
                transform: 'rotate(45deg)',
              }}
            />
            <BackgroundStar
              src={starImage}
              style={{
                width: '14px',
                height: '14px',
                right: '25%',
                top: '60%',
                transform: 'rotate(30deg)',
              }}
            />
            <StartTextRow>
              <IconSeer variant="waiting" color="textColor" size="lg" />
              <Fragment>{t('Need help digging deeper?')}</Fragment>
            </StartTextRow>
          </AutofixStartText>
          <InputWrapper onSubmit={handleSubmit}>
            <StyledInput
              autosize
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="(Optional) Share helpful context here..."
              maxLength={4096}
              maxRows={10}
              size="sm"
            />
            <StyledButton
              type="submit"
              priority="primary"
              analyticsEventKey={
                message
                  ? 'autofix.give_instructions_clicked'
                  : 'autofix.start_fix_clicked'
              }
              analyticsEventName={
                message
                  ? 'Autofix: Give Instructions Clicked'
                  : 'Autofix: Start Fix Clicked'
              }
              analyticsParams={{group_id: groupId}}
            >
              {t('Start Seer')}
            </StyledButton>
          </InputWrapper>
        </Container>
      </ScaleContainer>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: ${space(1)} ${space(4)};
  gap: ${space(1)};
`;

const ScaleContainer = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(1)};
`;

const Container = styled('div')`
  position: relative;
  width: 100%;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background}
    linear-gradient(135deg, ${p => p.theme.pink400}08, ${p => p.theme.pink400}20);
  overflow: hidden;
  padding: ${space(0.5)};
  border: 1px solid ${p => p.theme.border};
`;

const AutofixStartText = styled('div')`
  margin: 0;
  padding: ${space(1)};
  white-space: pre-wrap;
  word-break: break-word;
  font-size: ${p => p.theme.fontSize.lg};
  position: relative;
`;

const StartTextRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const BackgroundStar = styled('img')`
  position: absolute;
  filter: sepia(1) saturate(3) hue-rotate(290deg);
  opacity: 0.7;
  pointer-events: none;
  z-index: 0;
`;

const StyledArrow = styled(IconArrow)`
  color: ${p => p.theme.subText};
  opacity: 0.5;
`;

const InputWrapper = styled('form')`
  display: flex;
  gap: ${space(0.5)};
  padding: ${space(0.25)} ${space(0.25)};
`;

const StyledInput = styled(TextArea)`
  resize: none;

  border-color: ${p => p.theme.innerBorder};
  &:hover {
    border-color: ${p => p.theme.border};
  }
`;

const StyledButton = styled(Button)`
  flex-shrink: 0;
`;
