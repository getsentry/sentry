import {Component} from 'react';

import BaseAvatar from 'app/components/avatar/baseAvatar';
import {Team} from 'app/types';
import {explodeSlug} from 'app/utils';

type Props = {
  team: Team | null;
} & Omit<BaseAvatar['props'], 'uploadPath' | 'uploadId'>;

class TeamAvatar extends Component<Props> {
  render() {
    const {team, tooltip: tooltipProp, ...props} = this.props;
    if (!team) {
      return null;
    }
    const slug = (team && team.slug) || '';
    const title = explodeSlug(slug);
    const tooltip = tooltipProp ?? `#${title}`;

    return (
      <BaseAvatar
        {...props}
        type={(team.avatar && team.avatar.avatarType) || 'letter_avatar'}
        uploadPath="team-avatar"
        uploadId={team.avatar && team.avatar.avatarUuid}
        letterId={slug}
        tooltip={tooltip}
        title={title}
      />
    );
  }
}
export default TeamAvatar;
