import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { CreateOrderDto, PaginationOrdersDto, StatusOrderDto } from './dto';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @MessagePattern('createOrder')
  async create(@Payload() createOrderDto: CreateOrderDto) {
    try {
      const order = await this.ordersService.create(createOrderDto);
      const paymentSession =
        await this.ordersService.createPaymentSession(order);

      return {
        order,
        paymentSession,
      };
    } catch (error) {
      throw new RpcException(error);
    }
  }

  @MessagePattern('findAllOrders')
  findAll(@Payload() paginationDto: PaginationOrdersDto) {
    return this.ordersService.findAll(paginationDto);
  }

  @MessagePattern('findOneOrder')
  findOne(@Payload() id: string) {
    return this.ordersService.findOne(id);
  }

  @MessagePattern('changeOrderStatus')
  changeOrderStatus(@Payload() updateOrderDto: StatusOrderDto) {
    return this.ordersService.changeOrderStatus(updateOrderDto);
    // return this.ordersService.changeOrderStatus(updateOrderDto);
  }
}
