import React from 'react';

import Tag from 'app/components/tag';

/**
 * Used in new inbox
 * Renders the project badge and short name
 */

type Props = {
  shortId: string;
  avatar?: React.ReactNode;
};

const ShortId = ({shortId, avatar}: Props) => <Tag icon={avatar}>{shortId}</Tag>;

export default ShortId;
