import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { PaginationOrdersDto } from './dto/pagination-orders-dto';
import { PaidOrderDto, StatusOrderDto } from './dto';
import { catchError, firstValueFrom } from 'rxjs';
import { NATS_SERVICES } from 'src/config';
import { OrderWithProducts } from './interfaces/order-with-produts.interface';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrdersService');

  constructor(@Inject(NATS_SERVICES) private readonly client: ClientProxy) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.debug('Database connection has been established.');
  }
  async create(createOrderDto: CreateOrderDto) {
    const productIds = createOrderDto.items.map((product) => product.productId);
    const products: any[] = await this.getItemsByOrderId(productIds);
    const totalAmount = createOrderDto.items.reduce((acc, item) => {
      const price = products.find(
        (product) => product.id === item.productId,
      ).price;

      return acc + price * item.quantity;
    }, 0);

    const totalItems = createOrderDto.items.reduce((acc, item) => {
      return acc + item.quantity;
    }, 0);

    const order = await this.order.create({
      data: {
        totalAmount,
        totalItems,
        orderItems: {
          createMany: {
            data: createOrderDto.items.map((orderItem) => ({
              quantity: orderItem.quantity,
              productId: orderItem.productId,
              price: products.find(
                (product) => product.id === orderItem.productId,
              ).price,
            })),
          },
        },
      },
      include: {
        orderItems: {
          select: {
            price: true,
            quantity: true,
            productId: true,
          },
        },
      },
    });

    return this.returOrderWithItems(order, products);
  }

  async findAll(paginationDto: PaginationOrdersDto) {
    console.log(paginationDto);
    const total = await this.order.count({
      where: {
        status: paginationDto.status,
      },
    });
    const totalPages = Math.ceil(+total / paginationDto.limit);
    const currentPage = paginationDto.page;
    const orders = await this.order.findMany({
      where: {
        status: paginationDto.status,
      },
      skip: (paginationDto.page - 1) * paginationDto.limit,
      take: paginationDto.limit,
    });

    return {
      data: orders,
      pagination: {
        totalItems: total,
        totalPages: totalPages,
        currentPage: currentPage,
      },
    };
  }

  async findOne(id: string) {
    const order = await this.order.findUnique({
      where: {
        id,
      },
      include: {
        orderItems: {
          select: {
            price: true,
            quantity: true,
            productId: true,
          },
        },
      },
    });

    if (!order) {
      throw new RpcException({
        message: `Order id:  ${id} not found`,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const productIds = order.orderItems.map((item) => item.productId);
    const products: any[] = await this.getItemsByOrderId(productIds);

    return this.returOrderWithItems(order, products);
  }

  private returOrderWithItems(order: any, products: any[]) {
    return {
      ...order,
      orderItems: order.orderItems.map((item: any) => ({
        ...item,
        name: products.find((product) => product.id === item.productId).name,
        subir: 'prueba subir',
      })),
    };
  }

  private getItemsByOrderId(productIds: number[]): Promise<any> {
    try {
      return firstValueFrom(
        this.client.send({ cmd: 'validate-product' }, productIds).pipe(
          catchError((error) => {
            this.logger.error(error);
            throw new RpcException(error);
          }),
        ),
      );
    } catch (error) {
      throw new RpcException(error);
    }
  }

  changeOrderStatus(updateOrderDto: StatusOrderDto) {
    console.log(updateOrderDto);
    this.findOne(updateOrderDto.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: __, ...data } = updateOrderDto;
    // console.log(data);
    return this.order.update({
      where: {
        id: updateOrderDto.id,
      },
      data: data,
    });
  }

  async createPaymentSession(order: OrderWithProducts) {
    const paymentSession = await firstValueFrom(
      this.client.send('create.payment.session', {
        orderId: order.id,
        currency: 'usd',
        items: order.orderItems.map((item: any) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      }),
    );

    return paymentSession;
  }

  async paidOrder(paidOrderDto: PaidOrderDto) {
    this.logger.log('Order Paid');
    this.logger.log(paidOrderDto);

    const order = await this.order.update({
      where: { id: paidOrderDto.orderId },
      data: {
        status: 'PAID',
        paid: true,
        paidAt: new Date(),
        stripeChargeId: paidOrderDto.stripePaymentId,

        // La relación
        OrderReceipt: {
          create: {
            receiptUrl: paidOrderDto.receiptUrl,
          },
        },
      },
    });

    return order;
  }
}
