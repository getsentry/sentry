import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import CommitLink from 'app/components/commitLink';
import IdBadge from 'app/components/idBadge';
import Placeholder from 'app/components/placeholder';
import SentryTypes from 'app/sentryTypes';
import TimeSince from 'app/components/timeSince';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import SideHeader from './sideHeader';
import {IncidentSuspect} from '../types';

type Props = {
  className?: string;
  loading: boolean;
  suspects: {
    type: 'commit';
    data: IncidentSuspect;
  }[];
};

class Suspects extends React.Component<Props> {
  render() {
    const {className, loading, suspects} = this.props;

    if (!loading && !suspects.length) {
      return null;
    }

    return (
      <div className={className}>
        <SideHeader loading={loading}>
          {t('Suspects')} ({loading || !suspects ? '-' : suspects.length})
        </SideHeader>
        {loading ? (
          <Placeholder height="60px" bottomGutter={1} />
        ) : (
          suspects &&
          suspects.length > 0 && (
            <Panel>
              <PanelBody>
                {suspects.map(({type, data}) => (
                  <SuspectItem p={1} key={data.id}>
                    <Type>{type}</Type>
                    <Message type={type} suspect={data} />
                    <AuthorRow>
                      <IdBadge user={data.author} hideEmail />
                      <LightTimeSince date={data.dateCreated} />
                    </AuthorRow>
                  </SuspectItem>
                ))}
              </PanelBody>
            </Panel>
          )
        )}
      </div>
    );
  }
}

const StyledSuspects = styled(Suspects)<Props>`
  margin-top: ${space(1)};
`;

type SuspectsContainerProps = AsyncComponent['props'] &
  RouteComponentProps<{incidentId: string; orgId: string}, {}>;

export default class SuspectsContainer extends AsyncComponent<SuspectsContainerProps> {
  getEndpoints(): [string, string][] {
    const {orgId, incidentId} = this.props.params;

    return [['data', `/organizations/${orgId}/incidents/${incidentId}/suspects/`]];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderError(error) {
    return super.renderError(error, true, true);
  }

  renderBody() {
    return (
      <StyledSuspects
        loading={this.state.loading}
        suspects={this.state.data}
        {...this.props}
      />
    );
  }
}

function Message({type, suspect}) {
  const {message, id, repository} = suspect;
  if (type === 'commit') {
    return (
      <CommitRow>
        <MessageOverflow>
          <span>{message.split(/\n/)[0]}</span>
        </MessageOverflow>
        <CommitLink commitId={id} repository={repository} />
      </CommitRow>
    );
  }

  return null;
}

Message.propTypes = {
  type: PropTypes.oneOf(['commit']),
  suspect: SentryTypes.IncidentSuspectData,
};

const Type = styled('div')`
  text-transform: uppercase;
  color: ${p => p.theme.gray4};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: bold;
`;

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
`;
const CommitRow = styled(FlexCenter)`
  margin: ${space(0.5)} 0;
`;
const AuthorRow = styled(FlexCenter)`
  color: ${p => p.theme.gray2};
  justify-content: space-between;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const MessageOverflow = styled('div')`
  flex: 1;
  ${overflowEllipsis}
`;

const SuspectItem = styled(PanelItem)`
  flex-direction: column;
`;

const LightTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.fontSizeSmall};
`;
