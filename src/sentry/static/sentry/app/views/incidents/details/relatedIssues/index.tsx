import {Params} from 'react-router/lib/Router';
import React from 'react';
import styled from 'react-emotion';

import {Client} from 'app/api';
import {Organization} from 'app/types';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import Placeholder from 'app/components/placeholder';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import IssuesFetcher from './issuesFetcher';
import SideHeader from '../sideHeader';
import {Incident} from '../../types';

type Props = {
  api: Client;
  className?: string;
  incident?: Incident;
  params: Params;
  organization: Organization;
};

class RelatedIssues extends React.Component<Props> {
  render() {
    const {className, api, params, incident} = this.props;

    return (
      <div className={className}>
        <IssuesFetcher api={api} issueIds={incident && incident.groups}>
          {({issues, loading}) => {
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
                  <Placeholder height="60px" bottomGutter={1} />
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

const StyledRelatedIssues = styled(RelatedIssues)`
  margin-top: ${space(1)};
`;

export default withOrganization(withApi(StyledRelatedIssues));

const RelatedItem = styled(PanelItem)`
  flex-direction: column;
`;
