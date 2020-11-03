import React from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import Line from 'app/components/events/interfaces/frame/line';
import {t} from 'app/locale';
import {Frame} from 'app/types';

type Props = {
  type: string;
  data: Frame;
};

const TemplateInterface = ({type, data}: Props) => (
  <EventDataSection type={type} title={t('Template')}>
    <div className="traceback no-exception">
      <ul>
        <Line data={data} registers={{}} components={[]} isExpanded />
      </ul>
    </div>
  </EventDataSection>
);
export default TemplateInterface;
