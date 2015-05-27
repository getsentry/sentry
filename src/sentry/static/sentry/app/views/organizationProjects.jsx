/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");

var OrganizationHomeContainer = require("../components/organizationHomeContainer");

var OrganizationProjects = React.createClass({

  render() {

    return (
      <OrganizationHomeContainer>
        <div>
          <h3>My Projects</h3>
          <table className="table my-projects">
            <thead>
              <tr>
                <th>Project</th>
                <th>&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <a href="#">Captain Planet</a> <span className="divider">/</span> 🌍<strong><a href="#">Earth</a></strong>
                </td>
                <td className="align-right">
                  (graph)
                </td>
              </tr>
              <tr>
                <td>
                  <a href="#">Captain Planet</a> <span className="divider">/</span> 🔥<strong><a href="#">Fire</a></strong>
                </td>
                <td className="align-right">
                  (graph)
                </td>
              </tr>
              <tr>
                <td>
                  <a href="#">Captain Planet</a> <span className="divider">/</span> 💨<strong><a href="#">Wind</a></strong>
                </td>
                <td className="align-right">
                  (graph)
                </td>
              </tr>
              <tr>
                <td>
                  <a href="#">Captain Planet</a> <span className="divider">/</span> 💧<strong><a href="#">Water</a></strong>
                </td>
                <td className="align-right">
                  (graph)
                </td>
              </tr>
              <tr>
                <td>
                  <a href="#">Captain Planet</a> <span className="divider">/</span> 💖<strong><a href="#">Heart</a></strong>
                </td>
                <td className="align-right">
                  (graph)
                </td>
              </tr>
              <tr>
                <td>
                  <a href="#">Massive Dynamic</a> <span className="divider">/</span> <strong><a href="#">Ludic Science</a></strong>
                </td>
                <td className="align-right">
                  (graph)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </OrganizationHomeContainer>
    );
  }
});

module.exports = OrganizationProjects;
