import React from 'react';
import ConfigStore from '../../stores/configStore';
import Count from '../../components/count';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import {t} from '../../locale';

let getPercent = (item, total) => {
  if (total === 0) {
    return '';
  }
  if (item === 0) {
    return '0%';
  }
  return parseInt(item / total * 100, 10) + '%';
};

const ProjectTable = React.createClass({
  mixins: [PureRenderMixin],

  render() {
    let projectMap = this.props.projectMap;
    let projectTotals = this.props.projectTotals;
    let orgTotal = this.props.orgTotal;
    let org = this.props.organization;
    let urlPrefix = ConfigStore.get('urlPrefix') + '/' + org.slug;

    if (!projectTotals) {
      return <div/>;
    }

    // Sort based on # events received in desc order
    projectTotals.sort((a, b) => {
      return b.received - a.received;
    });

    return (
      <table className="table simple-list project-list">
        <thead>
          <tr>
            <th>{t('Project')}</th>
            <th className="align-right">{t('Accepted')}</th>
            <th className="align-right">{t('Dropped')}<br/>{t('(Rate Limit)')}</th>
            <th className="align-right">{t('Dropped')}<br/>{t('(Blacklist)')}</th>
            <th className="align-right">{t('Total')}</th>
          </tr>
        </thead>
        <tbody>
          {projectTotals.map((item) => {
            let project = projectMap[item.id];

            return (
              <tr key={item.id}>
                <td>
                  <a href={urlPrefix + '/' + project.slug + '/'}>{project.team.name} / {project.name}</a>
                </td>
                <td className="align-right">
                  <Count value={item.accepted} /><br/>
                  <small>{getPercent(item.accepted, orgTotal.accepted)}</small>
                </td>
                <td className="align-right">
                  <Count value={item.rejected} /><br/>
                  <small>{getPercent(item.rejected, orgTotal.rejected)}</small>
                </td>
                <td className="align-right">
                  <Count value={item.blacklisted} /><br/>
                  <small>{getPercent(item.blacklisted, orgTotal.blacklisted)}</small>
                </td>
                <td className="align-right">
                  <Count value={item.received} /><br/>
                  <small>{getPercent(item.received, orgTotal.received)}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
});

export default ProjectTable;
