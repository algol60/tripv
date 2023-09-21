import getDistance from '@turf/rhumb-distance';
import getBearing from '@turf/rhumb-bearing';

export default class TripBuilder {
  constructor({
    waypoints,
    speed = 10, // meters
    turnSpeed = 45, // degrees
    loop = false
  }) {
    this.name = waypoints.name;
    this.flag = waypoints.flag;
    this.color = waypoints.color;
    this.model = waypoints.model;
    this.keyframes = [];
    this.speed = speed;
    this.turnSpeed = turnSpeed;
    this.loop = loop;
    this.totalTime = 0;

    for (const p of waypoints.coords) {
      this._moveTo(p);
    }
    if (loop && waypoints.coords.length > 2) {
      this._moveTo(waypoints.coords[0]);
      this._turnTo(this.keyframes[0].heading);
    }
  }

  _moveTo(point) {
    if (this.keyframes.length === 0) {
      this.keyframes.push({
        point,
        time: 0
      });
      return;
    }

    const prevKeyframe = this.keyframes[this.keyframes.length - 1];
    const distance = getDistance(prevKeyframe.point, point, {units: 'kilometers'}) * 1000;
    const heading = getBearing(prevKeyframe.point, point);

    if (distance < 0.1) {
      return;
    }
    if (prevKeyframe.heading === undefined) {
      prevKeyframe.heading = heading;
    } else {
      this._turnTo(heading);
    }

    const duration = distance / this.speed;

    this.keyframes.push({
      point,
      heading,
      time: (this.totalTime += duration)
    });
  }

  _turnTo(heading) {
    const prevKeyframe = this.keyframes[this.keyframes.length - 1];
    const angle = Math.abs(getTurnAngle(prevKeyframe.heading, heading));

    if (angle > 0) {
      const duration = 0;//angle / this.turnSpeed;
      this.keyframes.push({
        point: prevKeyframe.point,
        heading,
        time: (this.totalTime += duration)
      });
    }
  }

  getFrame(timestamp_) {
    const timestamp = this.loop ? timestamp_ % this.totalTime : Math.min(timestamp_, this.totalTime);
    const i = this.keyframes.findIndex(s => s.time >= timestamp);
    const startState = this.keyframes[i - 1];
    const endState = this.keyframes[i];
    const r = (timestamp - startState.time) / (endState.time - startState.time);

    // Horizontal distance between the two points.
    const dist = getDistance(startState.point, endState.point, {units: 'kilometers'}) * 1000;

    // Difference in altitude from start to end point.
    const altitude_diff = endState.point[2] - startState.point[2];

    const toRadian = angle => (Math.PI / 180) * angle;
    const toDegree = angle => angle / (Math.PI/180);

    // Therefore, the angle of the line from start to end point.
    const pitch = toDegree(Math.atan2(altitude_diff, dist));

    return {
      point: [
        startState.point[0] * (1 - r) + endState.point[0] * r,
        startState.point[1] * (1 - r) + endState.point[1] * r,
        startState.point[2] * (1 - r) + endState.point[2] * r
      ],
      heading: startState.heading + getTurnAngle(startState.heading, endState.heading) * r,
      pitch: pitch,
      name: this.name,
      flag: this.flag,
      color: this.color,
      model: this.model
    };
  }
}

function getTurnAngle(startHeading, endHeading) {
  let turnAngle = endHeading - startHeading;
  if (turnAngle < -180) turnAngle += 360;
  if (turnAngle > 180) turnAngle -= 360;
  return turnAngle;
}
