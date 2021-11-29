enum VehicleSize {
  SMALL = 'small',
  COMPACT = 'compact',
  LARGE = 'large',
}

enum VehicleType {
  MOTORCYCLE = 'motorcycle',
  CAR = 'car',
  TRUCK = 'truck',
}

abstract class Vehicle {
  public size: VehicleSize;
  public location: number | undefined = undefined;
  public type: VehicleType;

  constructor(type: VehicleType, size: VehicleSize) {
    this.type = type;
    this.size = size;
  }
}

class Motorcycle extends Vehicle {
  constructor() {
    super(VehicleType.MOTORCYCLE, VehicleSize.LARGE);
  }
}

class Car extends Vehicle {
  constructor() {
    super(VehicleType.CAR, VehicleSize.COMPACT);
  }
}

class Truck extends Vehicle {
  constructor() {
    super(VehicleType.TRUCK, VehicleSize.LARGE);
  }
}

class ParkingSpot {
  spots: number[] = [];

  constructor(size: number) {
    this.spots = [...Array(size).keys()];
  }

  park(vehicle: Vehicle) {
    if (this.spots.length <= 0) {
      console.log('There are no more parking spaces for ' + vehicle.size + ' vehicles');
      return;
    }

    const location = this.spots.shift();
    vehicle.location = location;
  }

  unpark(vehicle: Vehicle) {
    if (vehicle.location === undefined) return;

    this.spots.push(vehicle.location);
    vehicle.location = undefined;
  }
}

class ParkingLot {
  motorcycleSpots: ParkingSpot;
  carSpots: ParkingSpot;
  truckSpots: ParkingSpot;

  constructor(numMotorcycleSpaces: number, numCarSpaces: number, numTruckSpots: number) {
    this.motorcycleSpots = new ParkingSpot(numMotorcycleSpaces);
    this.carSpots = new ParkingSpot(numCarSpaces);
    this.truckSpots = new ParkingSpot(numTruckSpots);
  }

  park(vehicle: Vehicle) {
    switch (vehicle.type) {
      case VehicleType.MOTORCYCLE:
        return this.motorcycleSpots.park(vehicle);
      case VehicleType.CAR:
        return this.carSpots.park(vehicle);
      default:
        return this.truckSpots.park(vehicle);
    }
  }

  unpark(vehicle: Vehicle) {
    switch (vehicle.type) {
      case VehicleType.MOTORCYCLE:
        return this.motorcycleSpots.unpark(vehicle);
      case VehicleType.CAR:
        return this.carSpots.unpark(vehicle);
      default:
        return this.truckSpots.unpark(vehicle);
    }
  }
}

// Motorcycle
const suzuki = new Motorcycle();

// Cars
const hyundai = new Car();
const bmw = new Car();
const fiat = new Car();

// Truck
const johnDeere = new Truck();
const mack = new Truck();

const ikeaParkingLot = new ParkingLot(5, 2, 1);
ikeaParkingLot.park(johnDeere);
ikeaParkingLot.unpark(johnDeere);
ikeaParkingLot.park(mack);
