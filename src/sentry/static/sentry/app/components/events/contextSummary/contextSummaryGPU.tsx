// export class GpuSummary extends React.Component {
//   static propTypes = {
//     data: PropTypes.object.isRequired,
//   };

//   render() {
//     const data = this.props.data;

//     if (objectIsEmpty(data) || !data.name) {
//       return <NoSummary title={t('Unknown GPU')} />;
//     }

//     let className = generateClassName(data.name);
//     let versionElement = null;

//     if (data.vendor_name) {
//       className = generateClassName(data.vendor_name);
//       versionElement = (
//         <p>
//           <strong>{t('Vendor:')}</strong> {data.vendor_name}
//         </p>
//       );
//     } else {
//       versionElement = (
//         <p>
//           <strong>{t('Vendor:')}</strong> {t('Unknown')}
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

const ContextSummaryGPU = ({data}: Props) => {
  console.log('ContextSummaryGPU', data);
  return null;
};

export default ContextSummaryGPU;
