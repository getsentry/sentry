import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Clipboard from 'sentry/components/clipboard';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageHeading from 'sentry/components/pageHeading';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

// import useProjects from 'sentry/utils/useProjects';
import Breadcrumb from './breadcrumb';
import Content from './content';
import useBreadcrumbs from './useBreadcrumbs';

interface Props extends RouteComponentProps<{userId: string}, {}, any, {t: number}> {}

function UserView({params: {userId}, router, route}: Props) {
  const location = useLocation();
  const org = useOrganization();
  const {isLoading, eventView, crumbs, transformedCrumbs, sampleEvent, relativeTime} =
    useBreadcrumbs({userId});

  return (
    <StyledPageContent>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb
            organization={org}
            eventView={eventView}
            location={location}
            userId={userId}
          />
          <PageHeading>{t('User Journey Details')}</PageHeading>
          <UserIdWrapper>
            {userId}
            <Clipboard value={userId}>
              <ClipboardIconWrapper>
                <IconCopy size="xs" />
              </ClipboardIconWrapper>
            </Clipboard>
          </UserIdWrapper>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          {isLoading && <LoadingIndicator />}
          {!isLoading && crumbs.length > 0 && sampleEvent && (
            <Content
              breadcrumbs={transformedCrumbs}
              displayRelativeTime={false}
              onSwitchTimeFormat={() => {}}
              organization={org}
              searchTerm=""
              event={sampleEvent}
              relativeTime={relativeTime || ''}
              emptyMessage={
                (<div>{t('There are no breadcrumbs to display')}</div>) as any
              }
              route={route}
              router={router}
            />
          )}
          {/* <PanelTable
            isLoading={isLoading}
            isEmpty={crumbs.length === 0}
            headers={[
              t('Category'),
              t('Type'),
              t('Level'),
              t('Data'),
              t('Message'),
              timestampTitle,
            ]}
          >
            {crumbs.map(crumb => (
              <Fragment key={crumb.timestamp}>
                <Item>{crumb.category}</Item>
                <Item>{crumb.type}</Item>
                <Item>{crumb.level}</Item>
                <Item>{JSON.stringify(crumb.data)}</Item>
                <Item>{crumb.message}</Item>
                <Item>
                  {FIELD_FORMATTERS.date.renderFunc('timestamp', {
                    ['timestamp']: crumb.timestamp,
                  })}
                </Item>
              </Fragment>
            ))}
          </PanelTable> */}
        </Layout.Main>
      </Layout.Body>
    </StyledPageContent>
  );
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const ClipboardIconWrapper = styled('span')`
  &:hover {
    cursor: pointer;
  }
  margin-left: 5px;
  display: flex;
  align-items: center;
`;

const UserIdWrapper = styled('span')`
  color: ${p => p.theme.gray300};
  display: flex;
`;

// TODO: keep?
// const _Header = styled('div')`
//   display: flex;
//   align-items: center;
//   justify-content: space-between;
//   margin-bottom: ${space(2)};
// `;

// const Item = styled('div')`
//   display: flex;
//   align-items: center;
// `;

export default UserView;
