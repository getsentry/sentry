import {Box, Flex} from 'grid-emotion';
import React from 'react';
import {Link} from 'react-router';

import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import CircleIndicator from 'app/components/circleIndicator';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SentryAppAvatar from 'app/components/avatar/sentryAppAvatar';
import PropTypes from 'prop-types';
import {Panel, PanelItem, PanelBody, PanelHeader} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {t} from 'app/locale';
import styled from 'react-emotion';
import space from 'app/styles/space';
import {withTheme} from 'emotion-theming';

class SentryApplicationRow extends React.PureComponent {
  static propTypes = {
    app: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
  };

  render() {
    let {app, orgId} = this.props;
    let btnClassName = 'btn btn-default';

    return (
      <PanelItem justify="space-between" px={2} py={2}>
        <Flex>
          <SentryAppAvatar size={36} sentryApp={app} />
          <Box pl={2} flex="1">
            <div style={{marginBottom: 3}}>
              <StyledLink to={`/settings/${orgId}/developer-settings/${app.slug}/`}>
                {app.name}
              </StyledLink>
            </div>
            <Status published={app.status === 'published'} />
          </Box>
        </Flex>

        <Flex align="center">
          <Box pl={2}>
            <a onClick={() => {}} className={btnClassName}>
              <span className="icon icon-trash" />
            </a>
          </Box>
        </Flex>
      </PanelItem>
    );
  }
}

export default class OrganizationDeveloperSettings extends AsyncView {
  getEndpoints() {
    let {orgId} = this.props.params;
    return [['applications', `/organizations/${orgId}/sentry-apps/`]];
  }

  renderBody() {
    let {orgId} = this.props.params;
    let action = (
      <Button
        priority="primary"
        size="small"
        className="ref-create-application"
        to={`/settings/${orgId}/developer-settings/new`}
        icon="icon-circle-add"
      >
        {t('Create New Application')}
      </Button>
    );

    let isEmpty = this.state.applications.length === 0;
    return (
      <div>
        <SettingsPageHeader title={t('Developer Settings')} action={action} />
        <Panel>
          <PanelHeader disablePadding>
            <Flex align="center">
              <Box px={2} flex="1">
                {t('Applications')}
              </Box>
            </Flex>
          </PanelHeader>
          <PanelBody>
            {!isEmpty ? (
              this.state.applications.map(app => {
                return <SentryApplicationRow key={app.uuid} app={app} orgId={orgId} />;
              })
            ) : (
              <EmptyMessage>{t('No applications have been created yet.')}</EmptyMessage>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

const StyledLink = styled(Link)`
  font-size: 22px;
  color: ${p => p.theme.textColor};
`;

const Status = styled(
  withTheme(props => {
    const {published, ...p} = props;
    return (
      <Flex align="center">
        <CircleIndicator size={4} color={published ? p.theme.success : p.theme.gray2} />
        <div {...p}>{published ? t('published') : t('unpublished')}</div>
      </Flex>
    );
  })
)`
  color: ${p => (p.published ? p.theme.success : p.theme.gray2)};
  margin-left: ${space(0.5)};
  font-weight: light;
  margin-right: ${space(0.75)};
`;
