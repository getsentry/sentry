import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';

import {t} from '../../locale';
import Checkbox from '../../components/checkbox';
import ExternalLink from '../../components/externalLink';
import SentryTypes from '../../proptypes';

class ProjectPluginRow extends React.PureComponent {
  static propTypes = {
    ...SentryTypes.Plugin,
    onChange: PropTypes.func,
    orgId: PropTypes.string,
    projectId: PropTypes.string,
  };

  handleChange = () => {
    let {onChange, id, enabled} = this.props;
    onChange(id, !enabled);
  };

  render() {
    let {
      orgId,
      projectId,
      id,
      name,
      slug,
      version,
      author,
      hasConfiguration,
      enabled,
    } = this.props;

    return (
      <tr key={id} className={slug}>
        <td colSpan={2}>
          <div className={`icon-integration icon-${id}`} />
          <h5>
            {`${name} `}
            <span>{version ? `v${version}` : <em>{t('n/a')}</em>}</span>
          </h5>
          <p>
            {author && <ExternalLink href={author.url}>{author.name}</ExternalLink>}
            {hasConfiguration && (
              <span>
                {' '}
                &middot;{' '}
                <Link to={`/${orgId}/${projectId}/settings/plugins/${id}`}>
                  {t('Configure plugin')}
                </Link>
              </span>
            )}
          </p>
        </td>
        <td className="align-right">
          <Checkbox name={slug} checked={enabled} onChange={this.handleChange} />
        </td>
      </tr>
    );
  }
}

export default ProjectPluginRow;
