import React from "react";
import ConfigStore from "../../stores/configStore";
import Count from "../../components/count";
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var getPercent = (item, total) => {
  if (total === 0) {
    return '';
  }
  if (item === 0) {
    return '0%';
  }
  return parseInt(item / total * 100, 10) + '%';
};

var ProjectTable = React.createClass({
  mixins: [PureRenderMixin],

  render() {
    var projectMap = this.props.projectMap;
    var projectTotals = this.props.projectTotals;
    var orgTotal = this.props.orgTotal;
    var org = this.props.organization;
    var urlPrefix = ConfigStore.get('urlPrefix') + '/' + org.slug;

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
            <th>Project</th>
            <th className="align-right">Accepted</th>
            <th className="align-right">Dropped<br/>(Rate Limit)</th>
            <th className="align-right">Dropped<br/>(Blacklist)</th>
            <th className="align-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {projectTotals.map((item) => {
            var project = projectMap[item.id];

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
