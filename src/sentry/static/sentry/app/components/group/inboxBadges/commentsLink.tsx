import React from 'react';
import {Link} from 'react-router';

import {IconChat} from 'app/icons';
import {SubscriptionDetails} from 'app/types';
import Tag from 'app/components/tag';

/**
 * Used in new inbox
 * Renders the comments link for the group
 */

type Props = {
  to: string;
  subscriptionDetails: SubscriptionDetails | null;
  numComments: number;
};

const CommentsLink = ({to, subscriptionDetails, numComments}: Props) => (
  <Link to={to} className="comments">
    <Tag
      icon={
        <IconChat
          size="xs"
          color={subscriptionDetails?.reason === 'mentioned' ? 'green300' : undefined}
        />
      }
    >
      {numComments}
    </Tag>
  </Link>
);

export default CommentsLink;
