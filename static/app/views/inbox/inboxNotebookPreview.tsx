import {IconEllipsis} from '@sentry/icons/ellipsis';
import {IconOpen} from '@sentry/icons/open';

import {LinkButton} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {InvestigationAccess} from 'sentry/views/investigations/detail/investigationAccess';
import {InvestigationPageContent} from 'sentry/views/investigations/detail/investigationPageContent';
import {useInvestigationDetail} from 'sentry/views/investigations/detail/useInvestigationDetail';
import {getInvestigationPath} from 'sentry/views/investigations/utils';

interface InboxNotebookPreviewProps {
  investigationId: string;
}

export function InboxNotebookPreview({investigationId}: InboxNotebookPreviewProps) {
  return (
    <InvestigationAccess>
      <InboxNotebookPreviewContent investigationId={investigationId} />
    </InvestigationAccess>
  );
}

function InboxNotebookPreviewContent({investigationId}: InboxNotebookPreviewProps) {
  const organization = useOrganization();
  const {data: investigation, isError, refetch} = useInvestigationDetail(investigationId);

  if (!investigation) {
    return isError ? <LoadingError onRetry={refetch} /> : <LoadingIndicator />;
  }

  return (
    <Container containerType="inline-size">
      <InvestigationPageContent
        investigation={investigation}
        showPageChrome={false}
        renderHeaderActions={actions => (
          <Flex align="center" gap="xs">
            <LinkButton
              size="sm"
              icon={<IconOpen />}
              aria-label={t('Open investigation')}
              tooltipProps={{title: t('Open investigation')}}
              to={getInvestigationPath(organization.slug, investigation.id)}
            />
            <DropdownMenu
              items={actions}
              position="bottom-end"
              trigger={(triggerProps, isOpen) => (
                <OverlayTrigger.IconButton
                  {...triggerProps}
                  size="sm"
                  icon={<IconEllipsis />}
                  aria-label={t('Investigation actions')}
                  aria-expanded={isOpen}
                />
              )}
            />
          </Flex>
        )}
      />
    </Container>
  );
}
