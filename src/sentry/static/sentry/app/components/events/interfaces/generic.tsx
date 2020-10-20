import PropTypes from 'prop-types';
import React, {Component} from 'react';

import ButtonBar from 'app/components/buttonBar';
import Button from 'app/components/button';
import EventDataSection from 'app/components/events/eventDataSection';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';
import {t} from 'app/locale';

function getView(view, data) {
  switch (view) {
    case 'report':
      return <KeyValueList data={Object.entries(data)} isContextData />;
    case 'raw':
      return <pre>{JSON.stringify({'csp-report': data}, null, 2)}</pre>;
    default:
      throw new TypeError(`Invalid view: ${view}`);
  }
}

type Props = {
  type: string;
  data: Record<string, any>;
};

type State = {
  view: string;
  data?: {[name: string]: any};
};

export default class GenericInterface extends Component<Props, State> {
  static propTypes = {
    type: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    const {data} = props;
    this.state = {
      view: 'report',
      data,
    };
  }

  state: State = {
    view: 'report',
  };

  toggleView = value => {
    this.setState({
      view: value,
    });
  };

  render() {
    const {view, data} = this.state;
    const {type} = this.props;

    const title = (
      <div>
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
        </ButtonBar>
        <h3>{t('Report')}</h3>
      </div>
    );

    const children = getView(view, data);

    return (
      <EventDataSection type={type} title={title} wrapTitle={false}>
        {children}
      </EventDataSection>
    );
  }
}
