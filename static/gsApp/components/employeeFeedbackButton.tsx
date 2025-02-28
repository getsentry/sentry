import {useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import {IconClose} from 'sentry/icons';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {useUser} from 'sentry/utils/useUser';

export default function EmployeeFeedbackButton() {
  const user = useUser();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const feedback = useFeedbackWidget({
    buttonRef,
    messagePlaceholder: t(
      'This feedback widget is only viewable by Sentry employees. Use this to quickly give feedback, especially useful if your replay captured something interesting.'
    ),
    formTitle: t('Internal Feedback'),
  });

  const [isHidden, setIsHidden] = useSessionStorage(
    'hide_employee_feedback_button',
    false
  );

  if (!user?.isSuperuser || !feedback || isHidden) {
    return null;
  }

  return (
    <PositionedContainer>
      <FeedbackButton
        aria-label={t('Give feedback (Sentry employees only)')}
        icon={<IconMegaphone color="gray500" />}
        onClick={e => e.stopPropagation()}
        ref={buttonRef}
        size="md"
        title={t('Give feedback (Sentry employees only)')}
      />
      <HideButton
        aria-label={t('Hide for this session')}
        borderless
        icon={<IconClose color="gray500" isCircled />}
        onClick={() => {
          setIsHidden(true);
        }}
        size="xs"
        title={t('Hide for this session')}
      />
    </PositionedContainer>
  );
}

const PositionedContainer = styled('div')`
  position: fixed;
  top: 45%;
  right: ${space(2)};
  z-index: ${p => p.theme.zIndex.modal};

  :hover button {
    visibility: visible;
  }
`;

const FeedbackButton = styled(Button)`
  border-radius: 50%;
  width: 2.5rem;
  height: 2.5rem;
`;

const HideButton = styled(Button)`
  visibility: hidden;
  border-radius: 50%;
  width: 1.6rem;
  height: 1.6rem;
  position: absolute;
  top: -10px;
  right: -10px;
  z-index: ${p => p.theme.zIndex.initial};
`;
