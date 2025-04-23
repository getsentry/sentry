import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useIsNextJsInsightsAvailable,
  useIsNextJsInsightsEnabled,
} from 'sentry/views/insights/pages/platform/nextjs/features';

export function NewNextJsExperienceButton() {
  const organization = useOrganization();
  const [isNextJsInsightsEnabled, setIsNextJsInsightsEnabled] =
    useIsNextJsInsightsEnabled();

  const isNextJsInsightsAvailable = useIsNextJsInsightsAvailable();

  const openForm = useFeedbackForm();

  const handleToggle = useCallback(() => {
    setIsNextJsInsightsEnabled(!isNextJsInsightsEnabled);
    trackAnalytics('nextjs-insights.ui_toggle', {
      isEnabled: !isNextJsInsightsEnabled,
      organization,
    });
  }, [setIsNextJsInsightsEnabled, isNextJsInsightsEnabled, organization]);

  if (!isNextJsInsightsAvailable) {
    return null;
  }

  if (!openForm || !isNextJsInsightsEnabled) {
    const label = isNextJsInsightsEnabled
      ? t('Switch to the old experience')
      : t('Switch to the new experience');
    const text = isNextJsInsightsEnabled ? null : t('Try New UI');

    return (
      <ToggleButton
        enabled={isNextJsInsightsEnabled}
        size="sm"
        icon={<IconLab isSolid={isNextJsInsightsEnabled} />}
        title={label}
        aria-label={label}
        onClick={handleToggle}
      >
        {text}
      </ToggleButton>
    );
  }

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <StyledDropdownButton
          {...triggerProps}
          enabled={isNextJsInsightsEnabled}
          size="sm"
          aria-label={t('Switch issue experience')}
        >
          {/* Passing icon as child to avoid extra icon margin */}
          <IconLab isSolid={isNextJsInsightsEnabled} />
        </StyledDropdownButton>
      )}
      items={[
        {
          key: 'switch-to-old-ui',
          label: t('Switch to the old experience'),
          onAction: handleToggle,
        },
        {
          key: 'give-feedback',
          label: t('Give feedback on new UI'),
          hidden: !openForm,
          onAction: () => {
            openForm({
              messagePlaceholder: t(
                'Excluding bribes, what would make you excited to use the new UI?'
              ),
              tags: {
                ['feedback.source']: 'NextJs-insights',
                ['feedback.owner']: 'telemetry-experience',
              },
            });
          },
        },
      ]}
      position="bottom-end"
    />
  );
}

const StyledDropdownButton = styled(DropdownButton)<{enabled: boolean}>`
  color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  :hover {
    color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  }
`;

const ToggleButton = styled(Button)<{enabled: boolean}>`
  color: ${p => (p.enabled ? p.theme.button.primary.background : p.theme.white)};
  background: ${p =>
    p.enabled ? 'inherit' : `linear-gradient(90deg, #3468D8, #248574)`};
  :hover {
    color: ${p => (p.enabled ? p.theme.button.primary.background : p.theme.white)};
  }
`;
