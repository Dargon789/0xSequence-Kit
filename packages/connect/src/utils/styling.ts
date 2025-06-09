import type { ModalPosition } from '../types.js'

export interface modalPositionCss {
  top?: string
  left?: string
  right?: string
  bottom?: string
}

export const getModalPositionCss = (position: ModalPosition) => {
  switch (position) {
    case 'top-right':
      return {
        top: '0px',
        right: '0px'
      }
    case 'top-left':
      return {
        top: '0px',
        left: '0px'
      }
    case 'top-center':
      return {
        top: '0px'
      }
    case 'bottom-right':
      return {
        bottom: '0px',
        right: '0px'
      }
    case 'bottom-left':
      return {
        bottom: '0px',
        left: '0px'
      }
    case 'bottom-center':
      return {
        bottom: '0px'
      }
    case 'middle-right':
      return {
        right: '0px'
      }
    case 'middle-left':
      return {
        left: '0px'
      }
    case 'center':
    default:
      return {}
  }
}
