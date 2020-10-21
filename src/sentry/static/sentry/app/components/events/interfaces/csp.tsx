import PropTypes from 'prop-types';
import { Component } from 'react';

import ButtonBar from 'app/components/buttonBar';
import Button from 'app/components/button';
import EventDataSection from 'app/components/events/eventDataSection';
import CSPContent from 'app/components/events/interfaces/cspContent';
import CSPHelp from 'app/components/events/interfaces/cspHelp';
import {t} from 'app/locale';
import {Event} from 'app/types';

function getView(view, data) {
  switch (view) {
    case 'report':
      return <CSPContent data={data} />;
    case 'raw':
      return <pre>{JSON.stringify({'csp-report': data}, null, 2)}</pre>;
    case 'help':
      return <CSPHelp data={data} />;
    default:
      throw new TypeError(`Invalid view: ${view}`);
  }
}

type Props = {
  event: Event;
  data: Record<string, any>;
};

export default class CspInterface extends Component<Props> {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  state = {view: 'report'};

  toggleView = value => {
    this.setState({
      view: value,
    });
  };

  render() {
    const {view} = this.state;
    const {data} = this.props;

    const cleanData =
      data.original_policy !== 'string'
        ? data
        : {
            ...data,
            // Hide the report-uri since this is redundant and silly
            original_policy: data.original_policy.replace(/(;\s+)?report-uri [^;]+/, ''),
          };

    const actions = (
      <ButtonBar merged active={view}>
        <Button
          barId="report"
          size="xsmall"
          onClick={this.toggleView.bind(this, 'report')}
        >
          {t('Report')}
        </Button>
        <Button barId="raw" size="xsmall" onClick={this.toggleView.bind(this, 'raw')}>
          {t('Raw')}
        </Button>
        <Button barId="help" size="xsmall" onClick={this.toggleView.bind(this, 'help')}>
          {t('Help')}
        </Button>
      </ButtonBar>
    );

    const children = getView(view, cleanData);

    return (
      <EventDataSection
        type="csp"
        title={<h3>{t('CSP Report')}</h3>}
        actions={actions}
        wrapTitle={false}
      >
        {children}
      </EventDataSection>
    );
  }
}
