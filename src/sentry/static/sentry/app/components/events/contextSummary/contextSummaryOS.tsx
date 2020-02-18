// export class OsSummary extends React.Component {
//   static propTypes = {
//     data: PropTypes.object.isRequired,
//   };

//   render() {
//     const data = this.props.data;

//     if (objectIsEmpty(data) || !data.name) {
//       return <NoSummary title={t('Unknown OS')} />;
//     }

//     const className = generateClassName(data.name);
//     let versionElement = null;

//     if (data.version) {
//       versionElement = (
//         <p>
//           <strong>{t('Version:')}</strong> {data.version}
//         </p>
//       );
//     } else if (data.kernel_version) {
//       versionElement = (
//         <p>
//           <strong>{t('Kernel:')}</strong> {data.kernel_version}
//         </p>
//       );
//     } else {
//       versionElement = (
//         <p>
//           <strong>{t('Version:')}</strong> {t('Unknown')}
//         </p>
//       );
//     }

//     return (
//       <div className={`context-item ${className}`}>
//         <span className="context-item-icon" />
//         <h3>{data.name}</h3>
//         {versionElement}
//       </div>
//     );
//   }
// }

import React from 'react';

type Props = {
  data: {};
};

const ContextSummaryOS = ({data}: Props) => {
  console.log('ContextSummaryOS', data);
  return null;
};

export default ContextSummaryOS;
