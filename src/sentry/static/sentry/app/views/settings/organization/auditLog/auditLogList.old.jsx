import PropTypes from 'prop-types';
import React from 'react';

import {t} from '../../../../locale';
import Avatar from '../../../../components/avatar';
import DateTime from '../../../../components/dateTime';
import Pagination from '../../../../components/pagination';
import SelectInput from '../../../../components/selectInput';

class OrganizationAuditLog extends React.Component {
  static propTypes = {
    entries: PropTypes.array,
    pageLinks: PropTypes.array,
    eventType: PropTypes.string,
    eventTypes: PropTypes.arrayOf(PropTypes.string),
    onEventSelect: PropTypes.func,
  };

  renderResults() {
    let {entries} = this.props;

    if (entries.length === 0) {
      return (
        <tr>
          <td colSpan="4">{t('No results found.')}</td>
        </tr>
      );
    }

    return entries.map(entry => {
      return (
        <tr key={entry.id}>
          <td className="table-user-info">
            {entry.actor.email && <Avatar user={entry.actor} />}
            <h5>{entry.actor.name}</h5>
            {entry.note}
          </td>
          <td>{entry.event}</td>
          <td>{entry.ipAddress}</td>
          <td>
            <DateTime date={entry.dateCreated} />
          </td>
        </tr>
      );
    });
  }

  render() {
    let {pageLinks, eventType, eventTypes, onEventSelect} = this.props;

    return (
      <div>
        <h3>{t('Audit Log')}</h3>

        <div className="pull-right">
          <form className="form-horizontal" style={{marginBottom: 20}}>
            <div className="control-group">
              <div className="controls">
                <SelectInput
                  name="event"
                  onChange={onEventSelect}
                  value={eventType}
                  style={{width: 250}}
                >
                  <option key="any" value="">
                    {t('Any')}
                  </option>
                  {eventTypes.map(type => {
                    return <option key={type}>{type}</option>;
                  })}
                </SelectInput>
              </div>
            </div>
          </form>
        </div>

        <p>{t('Sentry keeps track of important events within your organization.')}</p>

        <div className="panel panel-default horizontal-scroll c-b">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Member')}</th>
                <th>{t('Action')}</th>
                <th>{t('IP')}</th>
                <th>{t('Time')}</th>
              </tr>
            </thead>
            <tbody>{this.renderResults()}</tbody>
          </table>
        </div>
        {pageLinks && <Pagination pageLinks={pageLinks} {...this.props} />}
      </div>
    );
  }
}

export default OrganizationAuditLog;
