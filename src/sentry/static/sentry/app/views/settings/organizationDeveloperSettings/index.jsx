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
      <StyledSentryAppItem>
        <Flex>
          <SentryAppAvatar size={36} sentryApp={app} />
          <StyledSentryAppBox>
            <StyledSentryAppName>
              <StyledLink to={`/settings/${orgId}/developer-settings/${app.slug}/`}>
                {app.name}
              </StyledLink>
            </StyledSentryAppName>
            <Status published={app.status === 'published'} />
          </StyledSentryAppBox>
        </Flex>

        <Flex>
          <Box>
            <Button icon="icon-trash" onClick={() => {}} className={btnClassName} />
          </Box>
        </Flex>
      </StyledSentryAppItem>
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
          <PanelHeader>{t('Applications')}</PanelHeader>
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

const StyledSentryAppItem = styled(PanelItem)`
  justify-content: space-between;
  padding: 15px;
`;

const StyledSentryAppBox = styled(Box)`
  padding-left: 15px;
  flex: 1;
`;

const StyledSentryAppName = styled('div')`
  margin-bottom: 3px;
`;
const StyledLink = styled(Link)`
  font-size: 22px;
  color: ${props => props.theme.textColor};
`;

const Status = styled(
  withTheme(({published, ...props}) => {
    return (
      <Flex align="center">
        <CircleIndicator
          size={4}
          color={published ? props.theme.success : props.theme.gray2}
        />
        <div {...props}>{published ? t('published') : t('unpublished')}</div>
      </Flex>
    );
  })
)`
  color: ${props => (props.published ? props.theme.success : props.theme.gray2)};
  margin-left: ${space(0.5)};
  font-weight: light;
  margin-right: ${space(0.75)};
`;
