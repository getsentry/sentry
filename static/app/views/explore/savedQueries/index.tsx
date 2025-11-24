import {useNavigate} from 'react-router-dom';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';
import {SavedQueriesLandingContent} from 'sentry/views/explore/savedQueries/savedQueriesLandingContent';
import {getExploreUrl} from 'sentry/views/explore/utils';

export default function SavedQueriesView() {
  const organization = useOrganization();
  const hasLogsFeature = isLogsEnabled(organization);
  const navigate = useNavigate();

  const items = [
    {
      key: 'create-query-spans',
      label: <span>{t('Trace Query')}</span>,
      textValue: t('Create Traces Query'),
      onAction: () => {
        navigate(getExploreUrl({organization, visualize: []}));
      },
    },
    {
      key: 'create-query-logs',
      label: <span>{t('Logs Query')}</span>,
      textValue: t('Create Logs Query'),
      onAction: () => {
        navigate(getLogsUrl({organization}));
      },
    },
  ];

  return (
    <SentryDocumentTitle title={t('All Queries')} orgSlug={organization?.slug}>
      <Layout.Page>
        <Layout.Header unified>
          <Layout.HeaderContent>
            <Layout.Title>{t('All Queries')}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar>
              <FeedbackButton />
              {hasLogsFeature ? (
                <DropdownMenu
                  items={items}
                  trigger={triggerProps => (
                    <Button
                      {...triggerProps}
                      priority="primary"
                      icon={<IconAdd />}
                      size="sm"
                      aria-label={t('Save as')}
                      onClick={e => {
                        e.stopPropagation();
                        e.preventDefault();

                        triggerProps.onClick?.(e);
                      }}
                    >
                      {t('Create Query')}
                    </Button>
                  )}
                />
              ) : (
                <LinkButton
                  priority="primary"
                  icon={<IconAdd />}
                  size="sm"
                  to={getExploreUrl({organization, visualize: []})}
                >
                  {t('Create Query')}
                </LinkButton>
              )}
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main width="full">
            <SavedQueriesLandingContent />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
