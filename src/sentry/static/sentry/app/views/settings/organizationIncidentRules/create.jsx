import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import Graphic from 'app/components/charts/components/graphic';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import LineChart from 'app/components/charts/lineChart';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

class IncidentRulesCreate extends React.Component {
  static propTypes = {
    data: PropTypes.array,
  };

  static defaultProps = {
    data: [],
  };

  state = {
    width: null,
  };

  render() {
    const {orgId} = this.props.params;

    return (
      <div>
        <SettingsPageHeader title={t('New Incident Rule')} />
        <LineChart
          isGroupedByDate
          forwardedRef={e => {
            if (e && typeof e.getEchartsInstance === 'function') {
              const width = e.getEchartsInstance().getWidth();
              if (width !== this.state.width) {
                this.setState({width});
              }
            }
          }}
          graphic={Graphic({
            elements: [
              {
                type: 'line',
                draggable: true,
                shape: {y1: 1, y2: 1, x1: 0, x2: this.state.width},
                ondrag: () => {},
              },
            ],
          })}
          series={this.props.data}
        />
        <Form
          apiMethod="POST"
          apiEndpoint={`/organizations/${orgId}/incident-rules/`}
          initialData={{}}
          saveOnBlur={false}
        >
          <JsonForm
            forms={[
              {
                title: t('Metric'),
                fields: [
                  {
                    label: t('Metric'),
                    name: 'metric',
                    type: 'select',
                    help: t('Choose which metric to display on the Y-axis'),
                    choices: [['users', 'Users Affected']],
                  },
                  {
                    label: t('Upper Bound'),
                    name: 'upper',
                    type: 'range',
                    help: t(
                      'Anything trending above this limit will trigger an incident'
                    ),
                  },
                  {
                    label: t('Lower Bound'),
                    name: 'lower',
                    type: 'range',
                    help: t(
                      'Anything trending below this limit will trigger an incident'
                    ),
                  },
                ],
                required: true,
              },
            ]}
          />
        </Form>
      </div>
    );
  }
}

export default IncidentRulesCreate;
