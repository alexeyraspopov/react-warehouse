import React from 'react';
import { createResource, useResourceSync } from 'react-warehouse';

let Images = createResource({
  query(src) {
    return new Promise((resolve, reject) => {
      let img = new Image();
      img.src = src;
      img.onload = resolve;
      img.onerror = reject;
    });
  },
  maxAge: Infinity,
});

export default function Img(props) {
  useResourceSync(Images, [props.src]);
  return <img {...props} />;
}
