import {Box, Flex} from 'grid-emotion';
import Button from 'app/components/button';
import React from 'react';
import createReactClass from 'create-react-class';
import AsyncView from 'app/views/asyncView';
import PropTypes from 'prop-types'
import {Panel, PanelItem, PanelBody, PanelHeader} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {t} from 'app/locale';


class SentryApplicationRow extends React.Component {

  static propTypes = {
    app: PropTypes.object.isRequired,
  };

  render() {
    let app = this.props.app;

    let btnClassName = 'btn btn-default';

    return (
      <PanelItem justify="space-between" px={2} py={2}>
        <Box flex="1">
          <h4 style={{marginBottom: 5}}>
              {app.name}
          </h4>
        </Box>

        <Flex align="center">
          <Box pl={2}>
            <a
              onClick={()=> {}}
              className={btnClassName}
            >
              <span className="icon icon-trash" />
            </a>
          </Box>
        </Flex>
      </PanelItem>
    );
  }
};

export default class OrganizationDeveloperSettings extends AsyncView {
  getEndpoints() {
    let {orgId} = this.props.params;
    return [
      ['applications', `/sentry-apps/`]
    ];
  }

  renderBody(){
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
    console.log(this.state.applications);
    return (
      <div>
        <SettingsPageHeader title="Developer Settings" action={action} />
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
                return (
                  <SentryApplicationRow app={app}/>
                );
              })
            ) : (
              <EmptyMessage>
                {t("You haven't created any applications yet.")}
              </EmptyMessage>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}
