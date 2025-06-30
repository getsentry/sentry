import styled from '@emotion/styled';
import type {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/core/button';
import Placeholder from 'sentry/components/placeholder';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

function FeedbackButton() {
  const openForm = useFeedbackForm();

  return openForm ? (
    <Button
      size="xs"
      aria-label="trace-view-feedback"
      icon={<IconMegaphone size="xs" />}
      onClick={() =>
        openForm({
          messagePlaceholder: t('How can we make the trace view better for you?'),
          tags: {
            ['feedback.source']: 'trace-view',
            ['feedback.owner']: 'performance',
          },
        })
      }
    >
      {t('Give Feedback')}
    </Button>
  ) : null;
}

export const TRACE_FORMAT_PREFERENCE_KEY = 'trace_format_preference';

function ToggleTraceFormatButton({
  organization,
}: {
  location: Location;
  organization: Organization;
}) {
  const [storedTraceFormat, setStoredTraceFormat] = useSyncedLocalStorageState(
    TRACE_FORMAT_PREFERENCE_KEY,
    'non-eap'
  );

  return (
    <Feature
      organization={organization}
      features={['trace-spans-format', 'trace-view-admin-ui']}
    >
      <Button
        size="xs"
        aria-label="toggle-trace-format-btn"
        onClick={() => {
          setStoredTraceFormat(storedTraceFormat === 'eap' ? 'non-eap' : 'eap');
        }}
      >
        {storedTraceFormat === 'eap'
          ? t('Switch to Non-EAP Trace')
          : t('Switch to EAP Trace')}
      </Button>
    </Feature>
  );
}

const HeaderLayout = styled('div')`
  background-color: ${p => p.theme.background};
  padding: ${space(1)} ${space(3)} ${space(1)} ${space(3)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const HeaderRow = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(2)};
  align-items: center;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    gap: ${space(1)};
    flex-direction: column;
  }
`;

const HeaderContent = styled('div')`
  display: flex;
  flex-direction: column;
`;

const StyledBreak = styled('hr')`
  margin: ${space(1)} 0;
  border-color: ${p => p.theme.border};
`;

const StyledPlaceholder = styled(Placeholder)<{_height: number; _width: number}>`
  border-radius: ${p => p.theme.borderRadius};
  height: ${p => p._height}px;
  width: ${p => p._width}px;
`;

const TraceHeaderComponents = {
  HeaderLayout,
  HeaderRow,
  HeaderContent,
  StyledBreak,
  ToggleTraceFormatButton,
  FeedbackButton,
  StyledPlaceholder,
};

export {TraceHeaderComponents};
