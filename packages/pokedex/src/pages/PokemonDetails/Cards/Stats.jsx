import { formatStatsTitle } from "../../../utils/utils";
import "./Stats.scss";

const Stats = ({ stats }) => (
  <div className="stats">
    <span className="title">Stats</span>
    <table>
      <tbody>
        <tr>
          {stats.map((obj) => (
            <th key={obj.stat.name}>{formatStatsTitle(obj.stat.name)}</th>
          ))}
        </tr>
        <tr>
          {stats.map((obj, i) => (
            <td key={`base-stat-val${i}`}>{obj.base_stat}</td>
          ))}
        </tr>
      </tbody>
    </table>
  </div>
);

export default Stats;
