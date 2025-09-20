import {useState} from 'react';
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
            <SeerIconWrapper>
              <IconSeer variant="waiting" color="textColor" size="xl" />

              <BackgroundStar
                src={starImage}
                style={{
                  width: '20px',
                  height: '20px',
                  top: '-4px',
                  right: '-56px',
                  transform: 'rotate(15deg)',
                }}
              />
              <BackgroundStar
                src={starImage}
                style={{
                  width: '16px',
                  height: '16px',
                  top: '-12px',
                  left: '-64px',
                  transform: 'rotate(45deg)',
                }}
              />
              <BackgroundStar
                src={starImage}
                style={{
                  width: '14px',
                  height: '14px',
                  bottom: '-4px',
                  right: '-24px',
                  transform: 'rotate(30deg)',
                }}
              />
            </SeerIconWrapper>
            <StartTextRow />
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
              {t('Start Root Cause Analysis')}
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
  overflow: hidden;
  padding: ${space(0.5)};
`;

const AutofixStartText = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: ${space(1)};
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

const SeerIconWrapper = styled('div')`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const StyledArrow = styled(IconArrow)`
  color: ${p => p.theme.subText};
  opacity: 0.5;
`;

const InputWrapper = styled('form')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.formSpacing.md};
  padding: ${space(0.5)} ${space(0.5)};
  align-items: center;
  width: 100%;
  justify-content: center;
`;

const StyledInput = styled(TextArea)`
  resize: none;
  background: ${p => p.theme.background};
  width: 50%;
  min-width: 250px;

  border-color: ${p => p.theme.innerBorder};
  &:hover {
    border-color: ${p => p.theme.border};
  }
`;

const StyledButton = styled(Button)`
  flex-shrink: 0;
  width: 50%;
  min-width: 250px;
`;
