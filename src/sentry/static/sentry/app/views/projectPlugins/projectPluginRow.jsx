import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../locale';
import Checkbox from '../../components/checkbox';
import ExternalLink from '../../components/externalLink';
import PluginIcon from '../../plugins/components/pluginIcon';
import SentryTypes from '../../proptypes';
import DynamicWrapper from '../../components/dynamicWrapper';

const StyledPluginIcon = styled(PluginIcon)`
  position: absolute;
  top: 15px;
  left: 16px;
`;

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
          <StyledPluginIcon size={48} pluginId={id} />
          <h5>
            {`${name} `}
            <DynamicWrapper
              value={<span>{version ? `v${version}` : <em>{t('n/a')}</em>}</span>}
              fixed={<span>v10</span>}
            />
          </h5>
          <p>
            {author && <ExternalLink href={author.url}>{author.name}</ExternalLink>}
            {hasConfiguration && (
              <span>
                {' '}
                &middot;{' '}
                <Link to={`/${orgId}/${projectId}/settings/plugins/${id}/`}>
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
