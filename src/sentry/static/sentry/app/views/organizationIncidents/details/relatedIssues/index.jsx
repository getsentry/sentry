import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import IssuesFetcher from './issuesFetcher';
import Placeholder from '../placeholder';
import SideHeader from '../sideHeader';

const RelatedIssues = styled(
  class RelatedIssues extends React.Component {
    static propTypes = {
      api: PropTypes.object.isRequired,
      params: PropTypes.object.isRequired,
      incident: SentryTypes.Incident,
      loading: PropTypes.bool,
    };

    render() {
      const {className, api, params, incident} = this.props;

      return (
        <div className={className}>
          <IssuesFetcher api={api} issueIds={incident && incident.groups}>
            {({issues, loading, error}) => {
              // If loading is finished, and there are no issues, do not display anything
              if (!loading && issues && issues.length === 0) {
                return null;
              }

              return (
                <React.Fragment>
                  <SideHeader loading={loading}>
                    {t('Related Issues')} ({loading || !issues ? '-' : issues.length})
                  </SideHeader>
                  {loading ? (
                    <Placeholder />
                  ) : (
                    issues &&
                    issues.length > 0 && (
                      <Panel>
                        <PanelBody>
                          {issues.map(issue => (
                            <RelatedItem p={1} key={issue.id}>
                              <EventOrGroupHeader
                                params={params}
                                size="small"
                                hideLevel
                                data={issue}
                              />
                              <EventOrGroupExtraDetails params={params} {...issue} />
                            </RelatedItem>
                          ))}
                        </PanelBody>
                      </Panel>
                    )
                  )}
                </React.Fragment>
              );
            }}
          </IssuesFetcher>
        </div>
      );
    }
  }
)`
  margin-top: ${space(1)};
`;

export default withOrganization(withApi(RelatedIssues));

const RelatedItem = styled(PanelItem)`
  flex-direction: column;
`;
